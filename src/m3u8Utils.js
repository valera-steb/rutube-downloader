const m3u8Parser = require("m3u8-parser");
const fetch = require("node-fetch");

exports.getManifest = async function (url, msg) {
    const text = await getText(url, msg);

    const m3u8 = new m3u8Parser.Parser();
    m3u8.push(text);
    m3u8.end();
    return m3u8.manifest;
};

async function getText(url, msg = "fetch failed:") {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${msg} ${resp.status} ${resp.statusText}`);

    return await resp.text();
}
