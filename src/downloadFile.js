const path = require("node:path");
const util = require("node:util");
const stream = require("node:stream");
const fs = require("node:fs");

const _colors = require("ansi-colors");
const sanitize = require("sanitize-filename");
const splitFile = require("split-file");

const { createDir, deleteFiles, deleteFile } = require("./fsUtils");
const { parallelFor } = require("./parallelFor");
const fetch = require("node-fetch");
const { getProgress } = require("./progress");
const { execFFmpeg } = require("./FFmpeg");

const streamPipeline = util.promisify(stream.pipeline);

const existsCount = list =>
    list.reduce((sum, item) => (item ? sum + 1 : sum), 0);

const joinNames = list => ({ filename: list.join(", ") });

exports.downloadFile = async function (cfg, segments, options) {
    await createDir(cfg.video);
    await deleteFiles(/^segment-.*\.ts/, cfg.video);

    console.log(" ");
    console.log("       DOWNLOAD:", _colors.yellowBright(cfg.title), "\n");
    const progress = getProgress();

    const arrFiles = [];
    const activeSegmentsNums = [];

    progress.start(segments.length, 0, { filename: " " });

    await parallelFor(
        cfg.parallelNum,
        segments,
        async (segmentUrl, segmentIndex) => {
            const ext = path.extname(segmentUrl);
            const segmentFileName =
                "segment-" + `${segmentIndex + 1}`.padStart(10, "0") + ext;
            const segmentFilePath = path.join(cfg.video, segmentFileName);

            activeSegmentsNums.push(segmentIndex + 1);
            progress.update(
                existsCount(arrFiles),
                joinNames(activeSegmentsNums)
            );

            const error = await downloadSegment(
                segmentUrl,
                segmentFilePath,
                options
            );
            if (error) {
                progress.update(existsCount(arrFiles), {
                    filename: "NO SAVE: " + _colors.redBright(segmentFileName),
                });
                progress.stop();
                throw error;
            }

            arrFiles[segmentIndex] = segmentFilePath;
            const segmentFileNameIndex = activeSegmentsNums.indexOf(
                segmentIndex + 1
            );
            activeSegmentsNums.splice(segmentFileNameIndex, 1);

            progress.update(
                existsCount(arrFiles),
                joinNames(activeSegmentsNums)
            );
            await delay(50);
        }
    );

    progress.update(existsCount(arrFiles), { filename: " " });
    await delay(1000);
    progress.stop();
    const saveTitle = sanitize(cfg.title);
    const ext = path.extname(segments[0]);
    console.log("\u00A0");
    console.log(
        "COMBINING FILES:",
        _colors.yellowBright(`${arrFiles.length}`),
        "FILES INTO A",
        _colors.yellowBright(`"${saveTitle}${ext}"`),
        "PLEASE WAIT...",
        "\n"
    );
    await splitFile.mergeFiles(
        arrFiles,
        path.join(cfg.video, `${saveTitle}${ext}`)
    );
    console.log(
        "   DELETE FILES:",
        _colors.yellowBright(`${arrFiles.length}`),
        "\n"
    );
    await deleteFiles(/^segment-.*\.ts/, cfg.video);

    const videoFileName = `${saveTitle}.mp4`;
    const videoFilePath = path.join(cfg.video, videoFileName);
    await deleteFile(videoFilePath);
    //console.log("\u00A0");
    console.log(
        "     CONVERTING:",
        _colors.yellowBright(`"${saveTitle}${ext}"`)
    );
    console.log("             TO:", _colors.yellowBright(videoFileName));
    console.log("PLEASE WAIT...");
    console.log("\u00A0");
    const segmentsVideoFilePath = path.join(cfg.video, `${saveTitle}${ext}`);
    try {
        await execFFmpeg(segmentsVideoFilePath, videoFilePath);
        await deleteFile(segmentsVideoFilePath);
    } catch (e) {
        console.log(e);
    }
    console.log(_colors.yellowBright("DONE!"));
    console.log("_".padEnd(20, "_"));
    return videoFileName;
};

async function downloadSegment(segmentUrl, segmentFilePath, options) {
    try {
        let rs = await fetch(segmentUrl, options);
        if (rs.ok) {
            await streamPipeline(
                rs.body,
                fs.createWriteStream(segmentFilePath)
            );
            return null;
        } else {
            return new Error(`ошибка загрузки: ${rs.status} ${rs.statusText}`);
        }
    } catch (e) {
        return e;
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
