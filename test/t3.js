// test 
(async function () {
    let sync = require('../sml'), log = console.log
    log(await sync.findUpdatedImageFileWL('LIGABOLA'))
})()