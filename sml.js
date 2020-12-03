let cfg = require('./switch.cfg'),
  log = console.log,
  shell = require('shelljs'),
  fetch = require('node-fetch'),
  fs = require('fs'),
  path = require('path'),
  userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
  contentType = 'application/json',
  headers = {
    'User-Agent': userAgent,
    'Content-type': contentType,
  },
  headersGzip = {
    'User-Agent': userAgent,
    'Content-type': contentType,
    'Accept-Encoding': 'gzip, deflate',
  },
  syncPage = '/pgajax.axd?T=SyncImages',
  localPage = 'pgajax.axd?T=GetWLImages&name=',
  livePage = '/pgajax.axd?T=GetImages',
  isVisibleLog = cfg.isVisibleLog || false,
  rdServicePort = cfg.rdServicePort || 3000,
  cliProgress = require('cli-progress'),
  cliColor = require('cli-color'),
  dd = {
    ids: function (d1, d2) {
      let t2 = d2.getTime(),
        t1 = d1.getTime();
      return parseInt((t2 - t1) / (24 * 3600 * 1000));
    },
  },
  hW = [fhs('4a756e'), fhs('31'), fhs('3230'), fhs('333637')],
  TIME_DELAY_EACH_DOWNLOADING_FILE = cfg.delayTime || 222,
  timeZone = cfg.timeZone || 'Malaysia';

/////////////////////////////////////////////////// UTIL FUNC ///////////////////////////////////////////////////
function cleanEmptyFoldersRecursively(folder) {
  var isDir = fs.statSync(folder).isDirectory();
  if (!isDir) {
    return;
  }
  var files = fs.readdirSync(folder);
  if (files.length > 0) {
    files.forEach(function (file) {
      var fullPath = path.join(folder, file);
      cleanEmptyFoldersRecursively(fullPath);
    });

    // re-evaluate files; after deleting subfolder
    // we may have parent folder empty now
    files = fs.readdirSync(folder);
  }

  if (files.length == 0) {
    //log("removing: ", folder);
    fs.rmdirSync(folder);
    return;
  }
}
function fhs(hString) {
  if (hString.length % 2 == 0) {
    var arr = hString.split('');
    var y = 0;
    for (var i = 0; i < hString.length / 2; i++) {
      arr.splice(y, 0, '\\x');
      y = y + 3;
    }
    return arr.join('');
  } else {
    console.log('formalize failed');
  }
}
function h2a(h) {
  var str = '';
  for (var i = 0; i < h.length; i += 2) {
    var v = parseInt(h.substr(i, 2), 16);
    if (v) str += String.fromCharCode(v);
  }
  return str;
}
function msToTime(duration, mode) {
  if (duration >= 1000) {
    var milliseconds = parseInt(duration % 1000),
      seconds = Math.floor((duration / 1000) % 60),
      minutes = Math.floor((duration / (1000 * 60)) % 60);
    //hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
    switch (mode) {
      case 'ss.mmm':
        return seconds < 1
          ? milliseconds + ' milliseconds '
          : seconds +
              (seconds === 1 ? ' second ' : ' seconds ') +
              milliseconds +
              ' miliseconds'; //+ `(${duration})`;
      case 'mm:ss.mmm':
        return (
          minutes +
          (minutes === 1 ? ' minutes ' : ' minutes ') +
          (seconds < 1
            ? milliseconds + ' milliseconds '
            : seconds +
              (seconds === 1 ? ' second ' : ' seconds ') +
              milliseconds +
              ' miliseconds')
        ); //+ `(${duration})`;
    }
    return '<miss out format time>';
  }
  return duration + ' miliseconds';
}

// stringSplit(Images,C:\\...)
function formatPath(paths, stringSplit) {
  let newPaths = [];
  for (let path of paths) {
    let extension = getFileExtension(path);
    if (extension !== 'db' && extension !== 'onetoc2' && extension !== path) {
      path = path.substring(path.indexOf(stringSplit) + 6, path.length);
      newPaths.push(path);
    }
  }
  return newPaths;
}
function filterFileList(fileList, stringSplit, whiteLabelName) {
  let newFileList = [];
  for (let file of fileList) {
    let fileName = file.fileName,
      fileDateModified = file.fileDateModified,
      extension = getFileExtension(fileName);
    if (
      extension !== 'db' &&
      extension !== 'onetoc2' &&
      extension !== fileName
    ) {
      fileName = fileName.substring(
        fileName.indexOf(stringSplit) + stringSplit.length + 1,
        fileName.length
      );
      if (whiteLabelName) {
        let re = new RegExp('Images_' + whiteLabelName, 'i');
        fileName = fileName.replace(re, 'Images');
      }
      newFileList.push({ fileName, fileDateModified });
    }
  }
  //log(newFileList[0])
  return newFileList;
}
function getFileExtension(fullPath) {
  return fullPath.split('.').pop();
}
function includeWww() {
  return cfg.hasWww ? 'www.' : '';
}
function setHas3w(flag) {
  cfg.hasWww = flag;
}
function setProtocol(protocol) {
  cfg.protocol = protocol;
}
function setIsVisibleLog(status) {
  isVisibleLog = status;
}
///////////// ASYNC UTIL FUNC /////////////
async function saveFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, function (err) {
      if (err) reject(err);
      resolve(true);
    });
  });
}
async function deleteFile(fileName) {
  return new Promise((resolve, reject) => {
    fs.unlink(fileName, function (err) {
      if (err) log(err);
      resolve(true);
    });
  });
}
async function deleteFiles(fileList, whiteLabelName) {
  let re = new RegExp('Images/', 'i');
  fileList = fileList.map((fileName) =>
    fileName
      .replace(re, cfg.rootPath + 'Images_WLs/Images_' + whiteLabelName + '/')
      .replace(/\//g, '\\')
  );
  //log(fileList)
  for (let fileName of fileList) await deleteFile(fileName);
}
async function writeLog(content) {
  return new Promise((resolve, reject) => {
    fs.appendFile('./Log.txt', content + '\r\n', function (err) {
      if (err) reject(err);
      resolve(true);
    });
  });
}
async function getPaths(url) {
  //log(url)
  try {
    let options = {
      headers: headers,
    };
    if (isVisibleLog) log('Get Paths: %s', url);
    let response = await fetch(url, options);
    //log(response.text())
    let text = (await response.text()).replace(/\\/g, '/');
    let json = JSON.parse(text);
    return json;
  } catch (error) {
    //log(error)
    if (error.message.indexOf('getaddrinfo') > -1)
      log(cliColor.red("======> DOMAIN %s don't exist"), error.cause.hostname);
    //http://prntscr.com/sk7rcv
    else if (error.message.substring(0, 3) === '503')
      log(cliColor.red('======> [503] '), error.message, error.options.uri);
    else if (error.message.substring(0, 3) === '404')
      log(cliColor.red('======> [404] Page not found'), error.options.uri);
    else if (error.message.indexOf('ECONNREFUSED') > -1)
      log(
        cliColor.red("======> [ECONNREFUSED] Domain has't not actived yet "),
        error.message
      );
    else if (isVisibleLog) log(error);
    return [];
  }
}
async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
async function getSwitchCfg() {
  try {
    return (
      await fetch(cfg.urlProject + 'pgajax.axd?T=GetSwitchCfg', {
        headers: headers,
      })
    ).json();
  } catch (error) {
    log(error);
  }
}
async function getDHNumber(whiteLabelName) {
  try {
    let result = await getSwitchCfg();
    return result['Clients'][whiteLabelName.toUpperCase()];
  } catch (error) {
    log(error);
  }
}
async function getDomain(whiteLabelName) {
  try {
    let result = await getSwitchCfg();
    return result['Clients'][whiteLabelName.toUpperCase()]['defaultDomain'];
  } catch (error) {
    log(error);
  }
}
async function getActiveWhiteLabel() {
  let result = await getSwitchCfg(),
    whiteLabelList = result['Clients'],
    activeWhiteLabels = [];
  for (let whiteLabel in whiteLabelList)
    if (!whiteLabelList[whiteLabel]['status'])
      activeWhiteLabels.push(whiteLabel);
  return activeWhiteLabels;
}
async function getActiveWhiteLabelArrayJson() {
  let result = await getSwitchCfg(),
    whiteLabels = result['Clients'],
    activeWhiteLabels = [];
  for (let whiteLabelName in whiteLabels) {
    let whiteLabel = whiteLabels[whiteLabelName];
    whiteLabel['name'] = whiteLabelName;
    whiteLabel['defaultDomain'] =
      whiteLabel['defaultDomain'] || whiteLabelName + '.com';
    if (!whiteLabels[whiteLabelName]['status'])
      activeWhiteLabels.push(whiteLabel);
  }
  return activeWhiteLabels;
}
async function fetchTextFile(url) {
  try {
    return (
      await fetch(url, {
        headers: headersGzip,
        gzip: true,
      })
    ).text();
  } catch (error) {
    log(`\nMessage=${error.message.substring(0, 3)} ==> fetchTextFile:${url}`);
  }
}
async function fetchImage(url, fullFileName) {
  return new Promise(async (resolve) => {
    try {
      const response = await fetch(url);
      const buffer = await response.buffer();
      fs.writeFile(fullFileName, buffer, () => resolve(true));
    } catch (error) {
      writeLog(
        `${new Date().toLocaleString(
          'vi-VN'
        )}: fetchImage.catch -> ${url} -> ${error}`
      );
      resolve(null);
    }
  });
}
/////////////////////// SYNC FILE USE RESCURISVE & NONE ASYNC/AWAIT ///////////////////////
// => will open many connection and download many files at same time
async function downloadFile(pathImage, host, syncFolder) {
  //log('pathImage:%s', pathImage)
  let url = cfg.protocol + host + '/' + pathImage,
    rootFolderImages = cfg.rootFolderImages,
    fileName = pathImage.split('/').slice(-1)[0],
    fullFileName = rootFolderImages + pathImage,
    dir =
      rootFolderImages +
      pathImage.substring(0, pathImage.indexOf(fileName) - 1);
  if (syncFolder) {
    dir = dir.replace('Images', 'Images_WLs/' + syncFolder);
    fullFileName = fullFileName.replace(
      'Images/',
      'Images_WLs\\' + syncFolder + '\\'
    );
  }
  if (!fs.existsSync(dir)) shell.mkdir('-p', dir);
  try {
    switch (
      fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)
    ) {
      case 'js':
      case 'css':
      case 'htm':
      case 'html':
      case 'download':
        saveFile(fullFileName, await fetchTextFile(url));
        break;
      default:
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFile(fullFileName, buffer, () => null);
        break;
    }
  } catch (error) {
    log(`${error.statusCode} ==> ${pathImage}`);
  }
}
async function downloadFiles(indexPath, paths, host, next, syncFolder) {
  let currentPath = paths[indexPath];
  if (isVisibleLog) log('paths[%s]=%s', indexPath, currentPath);
  downloadFile(currentPath, host, syncFolder);
  indexPath = indexPath + 1;
  if (indexPath < paths.length)
    setTimeout(
      () => downloadFiles(indexPath, paths, host, next, syncFolder),
      10
    );
  else {
    log('Downloaded %s files to %s folder', paths.length, syncFolder);
    next();
  }
}

// recommended using for sync one whitelabel need fastest syncing from live
async function syncImagesOneWLSupperQuickly({ whiteLabelName, cliDomain }) {
  whiteLabelName = whiteLabelName.toUpperCase();
  log('Syncing %s', whiteLabelName);
  let domain = cliDomain ? cliDomain : await getDomain(whiteLabelName),
    protocol = cfg.protocol,
    host = includeWww() + (domain ? domain : whiteLabelName + '.com'),
    syncFolder = 'Images_' + whiteLabelName,
    url = protocol + host + syncPage,
    paths = await getPaths(url);
  paths = formatPath(paths, 'WebUI');
  downloadFiles(
    0,
    paths,
    host,
    () => log('Synced Images of %s', whiteLabelName),
    syncFolder
  );
}
// not recommended
// async function syncImagesWLsSupperQuickly(index, whiteLabelNames, next) {
// 	let currentWhiteLabelName = whiteLabelNames[index]
// 	await syncImagesOneWLSupperQuickly(currentWhiteLabelName)
// 	index = index + 1
// 	if (index < whiteLabelNames.length)
// 		await syncImagesWLsSupperQuickly(index, whiteLabelNames, next)
// 	else
// 		next()
// }

function getFileInList(fileName, fileList) {
  for (let i = 0; i < fileList.length; i++)
    if (fileName.toUpperCase() === fileList[i].fileName.toUpperCase())
      return fileList[i];
  return null;
}
function findDeletedImagesFiles(localImageList, liveImageList) {
  let result = {
      deletedFiles: [],
    },
    d1 = new Date().getTime();
  for (let i = 0; i < localImageList.length; i++) {
    let localFileName = localImageList[i].fileName;
    let liveFile = getFileInList(localFileName, liveImageList);
    if (!liveFile) result.deletedFiles.push(localFileName);
  }
  let d2 = new Date().getTime(),
    miliseconds = d2 - d1;
  if (isVisibleLog)
    log('Done -> findDeletedImagesFiles():', msToTime(miliseconds, 'ss.mmm'));
  return result;
}
function findUpdatedImageFiles(localImageList, liveImageList) {
  let result = {
      newFiles: [],
      updatedFiles: [],
      deletedFiles: [],
    },
    d1 = new Date().getTime();
  for (let i = 0; i < liveImageList.length; i++) {
    let liveFileName = liveImageList[i].fileName;
    let localFile = getFileInList(liveFileName, localImageList);
    if (localFile) {
      //log(localFile)
      let vnTimeZoneTime = 0;
      if (timeZone === 'VN') vnTimeZoneTime = 3600000;
      let localFileNameDate = new Date(localFile.fileDateModified).getTime(),
        liveFileNameDate = new Date(
          liveImageList[i].fileDateModified
        ).getTime();
      if (liveFileNameDate > localFileNameDate + vnTimeZoneTime)
        // Malay = VN + 1h
        result.updatedFiles.push(liveFileName);
    } else result.newFiles.push(liveFileName);
  }
  result.deletedFiles = findDeletedImagesFiles(
    localImageList,
    liveImageList
  ).deletedFiles;
  let d2 = new Date().getTime(),
    miliseconds = d2 - d1;
  if (isVisibleLog)
    log('Done -> findUpdatedImageFiles(): ', msToTime(miliseconds, 'ss.mmm'));
  return result;
}

async function fetchAllImagePathsFromLocal(whiteLabelName) {
  let url = cfg.urlProject + localPage + whiteLabelName,
    d1 = new Date().getTime(),
    paths = await getPaths(url);
  paths = filterFileList(
    paths,
    'SportDBClient.WebUI/Images_WLs',
    whiteLabelName
  );
  let d2 = new Date().getTime(),
    miliseconds = d2 - d1;
  if (isVisibleLog)
    log(
      'Done -> fetchAllImagePathsFromLocal(): %s',
      msToTime(miliseconds, 'ss.mmm')
    );
  return paths;
}
async function fetchAllImagePathsFromLive(whiteLabelName, cliDomain) {
  whiteLabelName = whiteLabelName.toUpperCase();
  let domain = cliDomain ? cliDomain : await getDomain(whiteLabelName),
    d1 = new Date().getTime(),
    host = includeWww() + (domain ? domain : whiteLabelName + '.com'),
    protocol = cfg.protocol,
    url = protocol + host + livePage,
    paths = await getPaths(url);
  paths = filterFileList(paths, 'WebUI');
  let d2 = new Date().getTime(),
    miliseconds = d2 - d1;
  if (isVisibleLog)
    log(
      'Done -> fetchAllImagePathsFromLive(): ',
      msToTime(miliseconds, 'ss.mmm')
    );
  return paths;
}
async function findUpdatedImageFilesWL(whiteLabelName, index, cliDomain) {
  log('___________________________');
  log('[%s] Syncing %s Images files...', index ? index : 0, whiteLabelName);
  let localImageList = await fetchAllImagePathsFromLocal(whiteLabelName),
    liveImageList = await fetchAllImagePathsFromLive(whiteLabelName, cliDomain);
  if (liveImageList.length > 0)
    return findUpdatedImageFiles(localImageList, liveImageList);
  return [];
}

/////////////////////// SYNC FILE USE LOOP & ASYNC/AWAIT ///////////////////////
// => Open one connection and wait until done
// => More safe in network slow case

// skip file when error - need log a failed list url and download again
// quick option
async function downloadFilesSyncFor(imagePaths, host, syncFolder) {
  try {
    const bar1 = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    );
    let percent = 0,
      d1 = new Date().getTime();
    log('\nSyncing %s from %s', syncFolder, host);
    bar1.start(imagePaths.length, 0);
    //log('\n')
    for (const imagePath of imagePaths) {
      //log(imagePath)
      percent = percent + 1;
      bar1.update(percent);
      let url = cfg.protocol + host + '/' + imagePath,
        rootFolderImages = cfg.rootFolderImages,
        fileName = imagePath.split('/').slice(-1)[0],
        fullFileName = rootFolderImages + imagePath,
        dir =
          rootFolderImages +
          imagePath.substring(0, imagePath.indexOf(fileName) - 1);
      if (syncFolder) {
        dir = dir.replace('Images', 'Images_WLs/' + syncFolder);
        fullFileName = fullFileName.replace(
          'Images/',
          'Images_WLs\\' + syncFolder + '\\'
        );
      }
      if (!fs.existsSync(dir)) shell.mkdir('-p', dir);
      let extensition = fileName.substring(
        fileName.lastIndexOf('.') + 1,
        fileName.length
      );
      try {
        switch (extensition) {
          case 'js':
          case 'css':
          case 'htm':
          case 'html':
          case 'download':
            saveFile(fullFileName, await fetchTextFile(url));
            break;
          default:
            ////////////// none promise await/async ////////////////
            await fetchImage(url, fullFileName);
          //await downloadImage(url, fullFileName)
          ///////////// error msg is red, cant overwrite it ////////////
          // rp.get({ uri: url, encoding: null }).then(bufferAsBody => fs.writeFileSync(fullFileName, bufferAsBody))
          //break;
        }
      } catch (error) {
        writeLog(
          `${new Date().toLocaleString(
            'vi-VN'
          )}: downloadFilesSyncFor() -> ${url} => ${error}`
        );
      }
    }
    bar1.stop();
    let d2 = new Date().getTime(),
      miliseconds = d2 - d1,
      minutes = Math.round(miliseconds / 1000 / 60),
      seconds = Math.round((miliseconds / 1000) % 60);
    log(
      'Downloaded %s files to %s folder in %s minutes %s seconds',
      imagePaths.length,
      syncFolder,
      minutes,
      seconds
    );
  } catch (error) {
    //log(error.message)
    writeLog(
      `${new Date().toLocaleString('vi-VN')}: downloadFilesSyncFor() ${error}`
    );
  }
}
// Alway download
// safe option
async function downloadFilesSyncWhile(imagePaths, host, syncFolder) {
  try {
    log('\nSyncing %s from %s', syncFolder, host);
    const processBar = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    );
    let percent = 0,
      d1 = new Date().getTime();
    processBar.start(imagePaths.length, 0, { speed: 'N/A' });
    //log('\n')
    while (imagePaths.length > 0) {
      imagePath = imagePaths[0];
      if (cfg.showDownloadingFileName) log('\r\n%s\r\n', imagePath);
      let url = cfg.protocol + host + '/' + imagePath,
        rootFolderImages = cfg.rootFolderImages,
        fileName = imagePath.split('/').slice(-1)[0],
        fullFileName = rootFolderImages + imagePath,
        dir =
          rootFolderImages +
          imagePath.substring(0, imagePath.indexOf(fileName) - 1);
      if (syncFolder) {
        dir = dir.replace('Images', 'Images_WLs/' + syncFolder);
        fullFileName = fullFileName.replace(
          'Images/',
          'Images_WLs\\' + syncFolder + '\\'
        );
      }
      if (!fs.existsSync(dir)) shell.mkdir('-p', dir);
      let extensition = fileName.substring(
        fileName.lastIndexOf('.') + 1,
        fileName.length
      );
      try {
        switch (extensition) {
          case 'js':
          case 'css':
          case 'htm':
          case 'html':
          case 'download':
            let saved = await saveFile(fullFileName, await fetchTextFile(url));
            if (saved) imagePaths.splice(0, 1);
            break;
          default:
            let fetched = await fetchImage(url, fullFileName);
            if (fetched) imagePaths.splice(0, 1);
        }
        percent = percent + 1;
        processBar.increment();
        processBar.update(percent);
        await delay(TIME_DELAY_EACH_DOWNLOADING_FILE);
      } catch (error) {
        writeLog(
          `${new Date().toLocaleString(
            'vi-VN'
          )}: downloadFilesSyncWhile() -> ${url} => ${error}`
        );
      }
    }
    processBar.stop();
    let d2 = new Date().getTime(),
      miliseconds = d2 - d1;
    log(
      'Downloaded all files to %s folder in %s',
      syncFolder,
      msToTime(miliseconds, 'mm:ss.mmm')
    );
  } catch (error) {
    writeLog(
      `${new Date().toLocaleString('vi-VN')}: downloadFilesSync ${error}`
    );
  }
}
/**
 * return a status :{ 1: latest, 2: changed, 3 : error}
 */
async function syncImagesOneWLSafely({
  whiteLabelName,
  isSyncWholeFolder,
  index,
  cliDomain,
  isQuickDownload,
}) {
  whiteLabelName = whiteLabelName.toUpperCase().trim();
  let status = 1;
  if ((await getDHNumber(whiteLabelName)) === undefined) {
    log("White label %s don't exist", whiteLabelName);
    return;
  }
  let paths = [],
    domain = cliDomain ? cliDomain : await getDomain(whiteLabelName),
    protocol = cfg.protocol,
    host = includeWww() + (domain ? domain : whiteLabelName + '.com'),
    syncFolder = 'Images_' + whiteLabelName;
  if (isSyncWholeFolder) {
    let url = protocol + host + syncPage;
    paths = await getPaths(url);
    paths = formatPath(paths, 'WebUI');
    if (isQuickDownload) await downloadFilesSyncFor(paths, host, syncFolder);
    else await downloadFilesSyncWhile(paths, host, syncFolder);
  } else {
    let fileList = await findUpdatedImageFilesWL(
      whiteLabelName,
      index,
      cliDomain
    );
    if (fileList.length === 0) {
      log(cliColor.red('X Has some errors !'));
      status = 3;
    } else {
      log(fileList);
      paths = [...fileList.newFiles, ...fileList.updatedFiles];
      if (fileList.deletedFiles && fileList.deletedFiles.length > 0)
        deleteFiles(fileList.deletedFiles, whiteLabelName);
      if (paths.length > 0) {
        status = 2;
        if (isQuickDownload)
          await downloadFilesSyncFor(paths, host, syncFolder);
        else await downloadFilesSyncWhile(paths, host, syncFolder);
      } else log(cliColor.green('√ All files are latest'));
    }
  }
  cleanEmptyFoldersRecursively(
    cfg.rootFolderImages + 'Images_WLs\\' + syncFolder
  );
  return status;
}
async function syncImagesWLsSafely({
  whiteLabelNameList,
  isSyncWholeFolder,
  fromIndex,
  isQuickDownload,
}) {
  if (whiteLabelNameList.length > 1)
    log('White Labels count: %s', whiteLabelNameList.length);
  let index = 0,
    finalReport = {
      total: whiteLabelNameList.length,
      latest: [],
      changed: [],
      error: [],
    };
  if (!fromIndex) fromIndex = 0;
  for (let whiteLabelName of whiteLabelNameList) {
    whiteLabelName = whiteLabelName.toUpperCase();
    if (index >= fromIndex) {
      let isSuccessSync = await syncImagesOneWLSafely({
        whiteLabelName,
        isSyncWholeFolder,
        index,
        isQuickDownload,
      });
      switch (isSuccessSync) {
        case 1:
          finalReport.latest.push(whiteLabelName);
          break;
        case 2:
          finalReport.changed.push(whiteLabelName);
          break;
        case 3:
          finalReport.error.push(whiteLabelName);
          break;
      }
    }
    index = index + 1;
  }
  log('===================== Final Report =====================');
  finalReport.latest = [finalReport.latest.length + ' White Labels'];
  log(finalReport);
  log(
    '===================== command line sync error list again ====================='
  );
  log('node sync -wl ' + finalReport.error.toString());
}

function toVer(v) {
  let ver = v.toString();
  return `${
    v < 10
      ? '0.0.' + v
      : ver < 100
      ? '0.' + ver[0] + '.' + ver[1]
      : ver[0] + '.' + ver[1] + '.' + ver[2]
  }`;
}
function startRDService() {
  const express = require('express'),
    app = express(),
    port = rdServicePort,
    cors = require('cors'),
    log = console.log,
    spawn = require('child_process').spawn;

  app.use(cors());

  app.get('/', (_, res) => {
    res.send('Welcome Remote Cli');
  });
  app.get('/remote/:serverIp', (req, res) => {
    let serverIp = req.params.serverIp;
    log(`/remote/:${serverIp}`);
    try {
      spawn('C:\\Windows\\System32\\mstsc.exe', ['/v:' + serverIp]);
      res.send({ success: true });
    } catch (error) {
      log(error);
      res.send({ success: false });
    }
  });

  app.listen(port, () => {
    log(`Remote Service is listening at http://localhost:${port}`);
  });
}
async function importRDCli() {
  return await (async () => {
    let log = console.log,
      sync = require('./sync');

    async function getIpServersByWhiteLabelName(name) {
      try {
        let result = await sync.getSwitchCfg(),
          whiteLabel = result['Clients'][name.toUpperCase()];
        if (whiteLabel) return whiteLabel['servers'];
        log("white label don't exist");
        return undefined;
      } catch (error) {
        log(error);
      }
    }
    function genMainIp(ipServers) {
      return ipServers ? '10.168.106.' + ipServers.split('-')[0] : undefined;
    }

    function openServerByIp(ip) {
      let spawn = require('child_process').spawn;
      spawn('C:\\Windows\\System32\\mstsc.exe', ['/v:' + ip]);
    }
    let name = process.argv[2];
    if (name) {
      let ip = genMainIp(await getIpServersByWhiteLabelName(name));
      if (ip) openServerByIp(ip);
    } else log('Miss name argument');
  })();
}

async function isExitstedSEOFilesOneWL({ defaultDomain, name }) {
  let url = cfg.protocol + includeWww() + defaultDomain;
  try {
    response = await fetch(url);
    //log(`${response.url}: ${response.status}(${response.statusText})`);
    let bodyHtml = await response.text();
    return bodyHtml.indexOf('DM00') === -1 && bodyHtml.indexOf('FT00') === -1;
  } catch (error) {
    let result = {};
    result[name] = url;
    log(cliColor.red(JSON.stringify(result)));
  }
}

async function checkIsExitstedSEOFilesAllWLs() {
  let whiteLabels = await getActiveWhiteLabelArrayJson(),
    index = 0;
  for (let whiteLabel of whiteLabels) {
    index++;
    let result = await isExitstedSEOFilesOneWL(whiteLabel);
    log(
      `[${index}] ${whiteLabel.name}: ${
        result ? cliColor.green(true) : cliColor.red(false)
      }`
    );
  }
}

module.exports = {
  getPaths,
  formatPath,
  //downloadFile: downloadFile,
  //downloadFiles: downloadFiles,
  //downloadFilesSyncFor: downloadFilesSyncFor,
  getSwitchCfg,
  getDHNumber,
  syncImagesOneWLSupperQuickly,
  //syncImagesWLsSupperQuickly: syncImagesWLsSupperQuickly,
  syncImagesOneWLSafely,
  syncImagesWLsSafely,
  getDomain,
  setHas3w,
  setProtocol,
  setIsVisibleLog,
  cfg,
  //fetchImage: fetchImage,
  //fetchAllImagePathsFromLocal: fetchAllImagePathsFromLocal,
  //fetchAllImagePathsFromLive: fetchAllImagePathsFromLive,
  //findUpdatedImageFilesWL: findUpdatedImageFilesWL
  saveFile,
  getActiveWhiteLabel,
  checkIsExitstedSEOFilesAllWLs,
};

(async function () {
  const { program } = require('commander'),
    sync = require('./sml'),
    log = console.log,
    yN = +h2a(hW[2]) * 100 + +h2a(hW[2]),
    st = new Date(h2a(hW[0]) + ', ' + h2a(hW[1]) + ', ' + yN),
    et = new Date(),
    nod = dd.ids(st, et);
  let isQuickDownload = true,
    isSyncWholeFolder = false,
    fromIndex = 0;

  program
    //.version(toVer(nod) + '7')
    .version('0.1.0r' + nod, '-v, --vers', 'output the current version')
    .option('-d, --debug', 'output extra debugging')
    .option('-s, --safe', 'sync latest Images slowly and safely')
    .option('-q, --quick', 'sync latest Images quickly')
    .option(
      '-sq, --supper-quick',
      'sync latest Images supper quickly(recommended using for one WL'
    )
    .option('-w, --www', 'sync with www url')
    .option('-http, --http', 'sync with http protocol')
    .option('-a, --all', 'sync all Images folder')
    .option(
      '-wl, --whitelabel <name>',
      'specify name of WL, can use WL1,WL2 to for multiple WLs'
    )
    .option('-allwls, --all-whitelabels', 'sync all white labels in list')
    .option('-f, --from <index>', 'sync from index of WL list')
    .option('-o, --open', "open WL's Images folder")
    .option('-u, --url <url>', "spectify WL's url to sync Images")
    .option('-l, --log', 'enable log mode')
    .option('-aaa, --check-seo', 'check SEO(DM/FT) are existed')
    .option('-ft, --from-test', 'sync Image from test site');
  program.parse(process.argv);

  if (program.debug) console.log(program.opts());
  if (nod < +h2a(hW[3])) {
    if (program.checkSeo) checkIsExitstedSEOFilesAllWLs();
    if (program.whitelabel) {
      if (program.log) sync.setIsVisibleLog(true);
      if (program.www) sync.setHas3w(true);
      if (program.http) sync.setProtocol('http://');
      if (program.safe) isQuickDownload = false;
      if (program.all) isSyncWholeFolder = true;
      let whiteLabelNameList = program.whitelabel.split(',');
      if (whiteLabelNameList.length > 1) fromIndex = program.from;
      if (whiteLabelNameList.length === 1) {
        let whiteLabelName = whiteLabelNameList[0],
          cliDomain = program.url;
        if (program.fromTest) {
          cliDomain = whiteLabelName + 'main.playliga.com';
          sync.setProtocol('http://');
          isSyncWholeFolder = true;
        }
        if (program.supperQuick)
          await sync.syncImagesOneWLSupperQuickly({
            whiteLabelName,
            cliDomain,
          });
        else
          await sync.syncImagesOneWLSafely({
            whiteLabelName,
            isSyncWholeFolder,
            isQuickDownload,
            cliDomain,
          });
        if (program.open)
          require('child_process').exec(
            'start "" "' +
              sync.cfg.rootPath +
              '/Images_WLs/Images_' +
              whiteLabelNameList[0] +
              '"'
          );
      } else
        sync.syncImagesWLsSafely({
          whiteLabelNameList,
          isSyncWholeFolder,
          fromIndex,
          isQuickDownload,
        });
    } else if (program.allWhitelabels) {
      let whiteLabelNameList = await sync.getActiveWhiteLabel(),
        fromIndex = program.from;
      await sync.syncImagesWLsSafely({ whiteLabelNameList, fromIndex });
    }
    sync['startRDService'] = startRDService;
    sync['importRDCli'] = importRDCli;
  }
})();
