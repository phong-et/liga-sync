// (async () => {
//   let log = console.log,
//     sync = require('./sync');

//   async function getIpServersByWhiteLabelName(name) {
//     try {
//       let result = await sync.getSwitchCfg(),
//         whiteLabel = result['Clients'][name.toUpperCase()];
//       if (whiteLabel) return whiteLabel['servers'];
//       log("white label don't exist");
//       return undefined;
//     } catch (error) {
//       log(error);
//     }
//   }
//   function genMainIp(ipServers) {
//     return ipServers ? '10.168.106.' + ipServers.split('-')[0] : undefined;
//   }

//   function openServerByIp(ip) {
//     let spawn = require('child_process').spawn;
//     spawn('C:\\Windows\\System32\\mstsc.exe', ['/v:' + ip]);
//   }
//   let name = process.argv[2];
//   if (name) {
//     let ip = genMainIp(await getIpServersByWhiteLabelName(name));
//     if (ip) openServerByIp(ip);
//   } else log('Miss name argument');
// })();
require('./sync').importRDCli()
