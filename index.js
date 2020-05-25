'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');

const minimist = require('minimist');
const superagent = require('superagent');

const mkdir = util.promisify(fs.mkdir);
const stat = util.promisify(fs.stat);
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const Throttle = require('superagent-throttle');

const agent = superagent.agent();

const throttle = new Throttle({
    rate: 10,          // how many requests can be sent every `ratePer`
    ratePer: 1000,   // number of ms in which `rate` requests may be sent
});

const mkdirNew = async (path, mode) => {
    try {
        await mkdir(path, mode);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
};

const downloadFile = (url, filePath) => {
    console.log(`Fetch file ${url} to ${filePath}`);
    return agent
        .get(url)
        .pipe(fs.createWriteStream(filePath));
};

const fetchAPI = (url) => {
    console.log(`Fetch API ${url}`);
    return agent.get(url).timeout(5000)
        .use(throttle.plugin())
        ;
};

async function downloadAttachments(row_dir, attachments) {
    const dir = path.join(row_dir, 'attachments');
    await mkdirNew(dir);
    for (const attachment of attachments) {
        const filePath = path.join(dir, attachment.filename);
        try {
            await stat(filePath);
            console.log('File exists in path', filePath);
        } catch (err) {
            await downloadFile(attachment.url, filePath);
        }
    }
}

async function downloadRecordRow(root_url, row, output_dir) {
    const row_url = `${root_url}api/records/${row.pk}`;
    const row_dir = path.join(output_dir, `${row.pk}`);
    await mkdirNew(row_dir);
    const row_file = path.join(row_dir, 'record.json');

    try {
        await readFile(row_file);
        console.log(`Skip fetch URL ${row_url}`);
    } catch (err) {
        const row_resp = await fetchAPI(row_url);
        await writeFile(row_file, JSON.stringify(row_resp.body));
    }

    if (row.content_object) {
        if (row.content_object.eml) {
            await downloadFile(row.content_object.eml, path.join(row_dir, 'raw_mail.eml'));
        }
        if (row.content_object.author_institution) {
            await downloadFile(row.content_object.author_institution, path.join(row_dir, 'institution.json'));
        }
        if (row.content_object.attachments) {
            await downloadAttachments(row_dir, row.content_object.attachments);
        }
    }
}

const downloadRecordList = async (root_url, case_id, output_dir) => {
    let next_url = `${root_url}api/records/?case=${case_id}`;
    while (next_url) {
        const resp = await fetchAPI(next_url);
        await Promise.all(resp.body.results.map(row => downloadRecordRow(root_url, row, output_dir)));
        next_url = resp.body.next;
    }
};


async function downloadCaseRow(root_url, row, output_dir) {
    const row_url = `${root_url}api/cases/${row.pk}`;
    const row_dir = path.join(output_dir, `${row.pk}`);
    await mkdirNew(row_dir);
    const row_file = path.join(row_dir, 'case.json');
    let now;
    try {
        now = JSON.parse(await readFile(row_file));
        console.log(`Skip fetch URL ${row_url}`);
    } catch (err) {
        const row_resp = await fetchAPI(row_url);
        await writeFile(row_file, JSON.stringify(row_resp.body));
        now = row_resp.body;
    }
    await writeFile(row_file, JSON.stringify(now));
    await downloadFile(row.institution, path.join(row_dir, 'institution.json'));
    await downloadRecordList(root_url, row.pk, row_dir);
}

const downloadCaseList = async (root_url, monitoring_id, output_dir) => {
    let next_url = `${root_url}api/cases/?monitoring=${monitoring_id}`;
    while (next_url) {
        const resp = await fetchAPI(next_url);
        // await Promise.all(resp.body.results.map(row => downloadCaseRow(root_url, row, output_dir)));
        for (const row of resp.body.results) { // Temporary avoid to much parallelization
            await downloadCaseRow(root_url, row, output_dir);
        }
        next_url = resp.body.next;
    }
};

const downloadMonitoring = async (root_url, monitoring_id, output_dir) => {
    const monitoring_url = `${root_url}api/monitoring/${monitoring_id}/`;
    const monitoring_dir = path.join(output_dir, `${monitoring_id}`);
    await mkdirNew(monitoring_dir);
    await downloadFile(monitoring_url, path.join(monitoring_dir, 'monitoring.json'));
    await downloadCaseList(root_url, monitoring_id, monitoring_dir);
};


const main = async () => {
    const argv = minimist(process.argv.slice(2));
    const root_url = argv.root || 'https://fedrowanie.siecobywatelska.pl/';
    const monitoring_id = argv.monitoring;
    if (!monitoring_id) {
        throw new Error('Missing --monitoring.');
    }
    if (typeof monitoring_id !== 'number') {
        throw new Error('Invalid argument for --monitoring.');
    }
    const output_dir = argv['output-dir'];
    if (!output_dir) {
        throw new Error('Missing --output-dir.');
    }
    await downloadMonitoring(root_url, monitoring_id, output_dir);
    console.log('Download finished!');
};


main().catch(err => {
    console.error('Something wrong!');
    console.error(err);
    process.exit(1);
});
