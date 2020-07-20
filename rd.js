const { args } = require('commander')

let cfg = require('./switch.cfg'),
    log = console.log,
    rp = require('request-promise'),
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36',
    contentType = 'application/json',
    headers = {
        'User-Agent': userAgent,
        'Content-type': contentType
    }

async function getSwitchCfg() {
    try {
        return JSON.parse(await rp({
            uri: cfg.urlProject + 'pgajax.axd?T=GetSwitchCfg',
            headers: headers
        }))
    } catch (error) {
        log(error)
    }
}
async function getIpServersByWhiteLabelName(name) {

    try {
        let result = await getSwitchCfg(),
        whiteLabel = result['Clients'][name.toUpperCase()]
        if(whiteLabel)
            return whiteLabel["servers"]
        log('white label don\'t exist')
        return undefined
    } catch (error) {
        log(error)
    }
}
function genMainIp(ipServers) {
    return ipServers ? '10.168.106.' + ipServers.split('-')[0] : undefined
}

function openServerByIp(ip) {
    let spawn = require('child_process').spawn
    spawn('C:\\Windows\\System32\\mstsc.exe', ['/v:' + ip])
}

(async () => {
    let name = process.argv[2]
    if (name) {
        let ip = genMainIp(await getIpServersByWhiteLabelName(name))
        if (ip)
            openServerByIp(ip)
    }
    else
        log('Miss name argument')
})()