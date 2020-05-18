// test 
(async function () {
    let sync = require('../sml'), log = console.log
    let localImageList = await sync.fetchAllImagePathsFromLocal('havana')
    let liveImageList = await sync.fetchAllImagePathsFromLive('havana')
    sync.findNewImageFiles(localImageList, liveImageList)
})()