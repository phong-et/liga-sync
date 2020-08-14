// Clone a list file to new list file
async function cloneImagesOneWL({ files, whiteLabelName, clonePath }) {
    for (file of files) {
        let rootPath = cfg.rootPath,
            srcFile = rootPath + 'Images_WLs\\Images_' + whiteLabelName + '\\' + file.srcName,
            destFile = (clonePath ? clonePath : rootPath) + 'Images_Clone\\Images_' + whiteLabelName + '\\' + file.destName,
            destPath = require('path').dirname(destFile)
        require("shelljs").mkdir("-p", destPath)
        try {
            fs.createReadStream(srcFile).pipe(fs.createWriteStream(destFile))
        } catch (error) {
            log('Error ==> %s', whiteLabelName)
        }
        //log("Copy " + srcFile + " to " + destFile + " success")
        //stream.on('finish', resolve)
    }
    log('Done %s', whiteLabelName)
    await delay(3333)
}
async function cloneImagesWLs({ files, whiteLabelNameList, clonePath }) {
    for (whiteLabelName of whiteLabelNameList)
        await cloneImagesOneWL({ files: files, whiteLabelName: whiteLabelName, clonePath: clonePath })
}

// Clone a folders to new folder
function cloneFolderOneWL(srcImagesFolder, destImagesFolder, callback) {
    log('==> Clone a source folder to dest folder ');
    let fsEx = require("fs-extra");
    fsEx.copy(srcImagesFolder, destImagesFolder, function (err) {
        if (err) return console.error(err)
        log('Copy ' + srcImagesFolder + ' to ' + destImagesFolder + ' success');
        callback();
    });
}
function cloneFolderWLs(whiteLabelList, srcImagesFolder) {
    let rootPath = cfg.rootPath
    srcImagesFolder = rootPath + srcImagesFolder
    for (let i = 0; i < whiteLabelList.length; i++) {
        destImagesFolder = rootPath + 'Images_' + whiteLabelList[i];
        copyImage(srcImagesFolder, destImagesFolder, function () {
            if (!fs.existsSync(destImagesFolder)) {
                fs.mkdirSync(destImagesFolder);
            }
            if (i++ < Clients.length - 1)
                copyImages();
            else
                log('Done all!');
        });
    }
}

(async function () {
    let sync = require('./sync')
    // cloneImagesWLs({ files: [{ srcName: 'btn/others.jpg', destName: 'btn/bg.png' }], whiteLabelNameList: await sync.getActiveWhiteLabel() })
    // Backup
    cloneImagesWLs(
        {
            files: [
                //{ srcName: 'btn/others.jpg', destName: 'btn/bg.png' }
                { srcName: "btn/4dspecials.jpg", destName: "btn/4dspecials.jpg" },
                { srcName: "btn/athelics.jpg", destName: "btn/athelics.jpg" },
                //{ srcName: "btn/aussieRulesFootball.jpg", destName: "btn/aussieRulesFootball.jpg" },
                { srcName: "btn/badminton.jpg", destName: "btn/badminton.jpg" },
                { srcName: "btn/baseball.jpg", destName: "btn/baseball.jpg" },
                { srcName: "btn/basketball.jpg", destName: "btn/basketball.jpg" },
                { srcName: "btn/beachball.jpg", destName: "btn/beachball.jpg" },
                //{ srcName: "btn/bg.png", destName: "btn/bg.png" },
                { srcName: "btn/boxing.jpg", destName: "btn/boxing.jpg" },
                { srcName: "btn/cricket.jpg", destName: "btn/cricket.jpg" },
                { srcName: "btn/cycling.jpg", destName: "btn/cycling.jpg" },
                { srcName: "btn/darts.jpg", destName: "btn/darts.jpg" },
                { srcName: "btn/entertainment.jpg", destName: "btn/entertainment.jpg" },
                { srcName: "btn/favourite.jpg", destName: "btn/favourite.jpg" },
                { srcName: "btn/financial.jpg", destName: "btn/financial.jpg" },
                { srcName: "btn/football.jpg", destName: "btn/football.jpg" },
                { srcName: "btn/futsal.jpg", destName: "btn/futsal.jpg" },
                //{ srcName: "btn/gaelicFootball.jpg", destName: "btn/gaelicFootball.jpg" },
                { srcName: "btn/golf.jpg", destName: "btn/golf.jpg" },
                { srcName: "btn/handball.jpg", destName: "btn/handball.jpg" },
                { srcName: "btn/hockey.jpg", destName: "btn/hockey.jpg" },
                { srcName: "btn/keno.jpg", destName: "btn/keno.jpg" },
                { srcName: "btn/lacrosse.jpg", destName: "btn/lacrosse.jpg" },
                //{ srcName: "btn/mixedMartialArts.jpg", destName: "btn/mixedMartialArts.jpg" },
                { srcName: "btn/motor.jpg", destName: "btn/motor.jpg" },
                { srcName: "btn/olympic.jpg", destName: "btn/olympic.jpg" },
                { srcName: "btn/others.jpg", destName: "btn/others.jpg" },
                { srcName: "btn/rugby.jpg", destName: "btn/rugby.jpg" },
                { srcName: "btn/snooker.jpg", destName: "btn/snooker.jpg" },
                { srcName: "btn/soccer.jpg", destName: "btn/soccer.jpg" },
                { srcName: "btn/squash.jpg", destName: "btn/squash.jpg" },
                { srcName: "btn/supercombo.jpg", destName: "btn/supercombo.jpg" },
                { srcName: "btn/tableTennis.jpg", destName: "btn/tableTennis.jpg" },
                { srcName: "btn/tennis.jpg", destName: "btn/tennis.jpg" },
                { srcName: "btn/volleyBall.jpg", destName: "btn/volleyBall.jpg" },
                { srcName: "btn/waterPolo.jpg", destName: "btn/waterPolo.jpg" },
                { srcName: "btn/winterSport.jpg", destName: "btn/winterSport.jpg" }
            ],
            whiteLabelNameList:
                //["WINNING228", "WPBET365", "WSDBOLA88"]
                await sync.getActiveWhiteLabel()
        })
})

