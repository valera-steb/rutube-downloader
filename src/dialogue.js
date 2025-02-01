const readline = require("readline");

module.exports = {
    rl: readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    }),

    selectVideoQuality: (cfg, playlists) => {
        const qualitiesOptions = playlists.map(({ attributes }, index) => {
            const { width, height } = attributes.RESOLUTION;
            return `${index} : ${width}x${height} ${attributes.CODECS}`;
        });

        if (cfg.quality) {
            const selectedIndex = qualitiesOptions.indexOf(cfg.quality.label);
            if (selectedIndex === cfg.quality.index)
                return [playlists[selectedIndex]["uri"], cfg.quality];
        }

        console.log("Выберите качество для видео: " + cfg.title);
        for (let item of qualitiesOptions) console.log(item);

        return new Promise(resolve =>
            module.exports.rl.question("", answer => {
                const index = Number.parseInt(answer);
                console.log("Выбран вариант:", qualitiesOptions[index]);
                resolve([
                    playlists[index]["uri"],
                    { index, label: qualitiesOptions[index] },
                ]);
            })
        );
    },
};
