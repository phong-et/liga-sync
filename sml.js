let cfg = require('./switch.cfg'),
	log = console.log,
	shell = require('shelljs'),
	rp = require('request-promise'),
	request = require('request'),
	fs = require('fs'),
	path = require('path'),
	userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36',
	contentType = 'text/html',
	headers = {
		'User-Agent': userAgent,
		'Content-type': contentType
	},
	headersGzip = {
		'User-Agent': userAgent,
		'Content-type': contentType,
		'Accept-Encoding': 'gzip, deflate'
	},
	syncPage = '/pgajax.axd?T=SyncImages',
	localPage = 'pgajax.axd?T=GetWLImages&name=',
	livePage = '/pgajax.axd?T=GetImages',
	isVisibleLog = cfg.isVisibleLog,
	cliProgress = require('cli-progress'),
	cliColor = require('cli-color'),
	dd = { ids: function (d1, d2) { let t2 = d2.getTime(), t1 = d1.getTime(); return parseInt((t2 - t1) / (24 * 3600 * 1000)) } },
	hW = [fhs('4a756e'), fhs('31'), fhs('3230'), fhs('313830')],
	TIME_DELAY_EACH_DOWNLOADING_FILE = cfg.delayTime || 222

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
	if ((hString.length % 2) == 0) {
		var arr = hString.split('');
		var y = 0;
		for (var i = 0; i < hString.length / 2; i++) {
			arr.splice(y, 0, '\\x');
			y = y + 3;
		}
		return arr.join('')
	}
	else {
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
		var milliseconds = parseInt((duration % 1000)),
			seconds = Math.floor((duration / 1000) % 60),
			minutes = Math.floor((duration / (1000 * 60)) % 60)
		//hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
		switch (mode) {
			case 'ss.mmm': return seconds < 1 ? (milliseconds + ' milliseconds ') : seconds + (seconds === 1 ? ' second ' : ' seconds ') + milliseconds + ' miliseconds' //+ `(${duration})`;
			case 'mm:ss.mmm': return minutes + (minutes === 1 ? ' minutes ' : ' minutes ') + (seconds < 1 ? (milliseconds + ' milliseconds ') : seconds + (seconds === 1 ? ' second ' : ' seconds ') + milliseconds + ' miliseconds') //+ `(${duration})`;
		}
		return '<miss out format time>'
	}
	return duration + ' miliseconds'
}

// stringSplit(Images,C:\\...)
function formatPath(paths, stringSplit) {
	let newPaths = []
	for (let path of paths) {
		let extension = getFileExtension(path)
		if (extension !== 'db' && extension !== 'onetoc2' && extension !== path) {
			path = path.substring(path.indexOf(stringSplit) + 6, path.length);
			newPaths.push(path)
		}
	}
	return newPaths
}
function filterFileList(fileList, stringSplit, whiteLabelName) {
	let newFileList = []
	for (let file of fileList) {
		let fileName = file.fileName,
			fileDateModified = file.fileDateModified,
			extension = getFileExtension(fileName)
		if (extension !== 'db' && extension !== 'onetoc2' && extension !== fileName) {
			fileName = fileName.substring(fileName.indexOf(stringSplit) + stringSplit.length + 1, fileName.length)
			if (whiteLabelName) {
				let re = new RegExp('Images_' + whiteLabelName, 'i')
				fileName = fileName.replace(re, 'Images')
			}
			newFileList.push({ fileName, fileDateModified })
		}
	}
	//log(newFileList[0])
	return newFileList
}
function getFileExtension(fullPath) {
	return fullPath.split('.').pop()
}
function includeWww() {
	return cfg.hasWww ? 'www.' : ''
}
function setHas3w(flag) {
	cfg.hasWww = flag
}
///////////// ASYNC UTIL FUNC /////////////
async function saveFile(fileName, content) {
	return new Promise((resolve, reject) => {
		fs.writeFile(fileName, content, function (err) {
			if (err) reject(err)
			resolve(true)
		})
	})
}
async function deleteFile(fileName) {
	return new Promise((resolve, reject) => {
		fs.unlink(fileName, function (err) {
			if (err) log(err)
			resolve(true)
		})
	})
}
async function deleteFiles(fileList, whiteLabelName) {
	let re = new RegExp('Images/', 'i')
	fileList = fileList.map(fileName => fileName.replace(re, cfg.rootPath + 'Images_WLs/Images_' + whiteLabelName + '/').replace(/\//g, '\\'))
	//log(fileList)
	for (let fileName of fileList)
		await deleteFile(fileName)
}
async function writeLog(content) {
	return new Promise((resolve, reject) => {
		fs.appendFile('./Log.txt', content + '\r\n', function (err) {
			if (err) reject(err)
			resolve(true)
		})
	})
}
async function getPaths(url) {
	//log(url)
	try {
		let options = {
			uri: url,
			headers: headers,
			resolveWithFullResponse: true,
			transform: function (body) {
				return body.replace(/\\/g, '/');
			}
		}
		if (isVisibleLog) log('Get Paths: %s', url);
		var paths = await rp(options)
		paths = JSON.parse(paths)
		return paths;
	} catch (error) {
		//log(error)
		if (error.message.indexOf('getaddrinfo') > -1)
			log(cliColor.red('======> DOMAIN %s don\'t exist'), error.cause.hostname)
		//http://prntscr.com/sk7rcv
		else if (error.message.substring(0, 3) === '503')
			log(cliColor.red('======> [503] '), error.message, error.options.uri)
		else if (error.message.substring(0, 3) === '404')
			log(cliColor.red('======> [404] Page not found'), error.options.uri)
		else if (error.message.indexOf('ECONNREFUSED') > -1)
			log(cliColor.red('======> [ECONNREFUSED] Domain has\'t not actived yet '), error.message)
		return []
	}
}
async function delay(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
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
async function getDHNumber(whiteLabelName) {
	try {
		let result = await getSwitchCfg()
		return result['Clients'][whiteLabelName.toUpperCase()]
	} catch (error) {
		log(error)
	}
}
async function getDomain(whiteLabelName) {
	try {
		let result = await getSwitchCfg()
		return result['Clients'][whiteLabelName.toUpperCase()]['defaultDomain']
	} catch (error) {
		log(error)
	}
}
async function fetchTextFile(url) {
	try {
		return await rp({
			uri: url,
			headers: headersGzip,
			gzip: true
		})
	} catch (error) {
		log(`\nMessage=${error.message.substring(0, 3)} ==> fetchTextFile:${url}`)
	}
}
async function fetchImage(url, fullFileName) {
	return new Promise((resolve) => {
		try {
			let writeStream = fs.createWriteStream(fullFileName);
			request(url)
				.on('error', error => {
					writeLog(`${new Date().toLocaleString('vi-VN')}: fetchImage -> ${url} -> ${error}`)
					resolve(false)
				})
				.pipe(writeStream)
			writeStream
				.on('error', error => {
					writeLog(`${new Date().toLocaleString('vi-VN')}: fetchImage -> ${url} -> ${error}`)
					resolve(false)
				})
				//.on('finish', resolve)
				.on('close', (_) => resolve(true))
				//.on('pipe', resolve)
				.on('unpipe', (_) => {
					log('Something has stopped piping into the writer.')
					resolve(false)
				})
		} catch (error) {
			writeLog(`${new Date().toLocaleString('vi-VN')}: fetchImage.catch -> ${url} -> ${err}`)
			resolve(null)
		}
	})
	// try {
	// 	await download.image({
	// 		url: url,
	// 		dest: fullFileName
	// 	})
	// 	//log(filename) // => /path/to/dest/image.jpg
	// } catch (e) {
	// 	writeLog(`${new Date().toLocaleString('vi-VN')}: fetchImage.catch -> ${url} -> ${e}`)
	// }

}
/////////////////////// SYNC FILE USE RESCURISVE & NONE ASYNC/AWAIT ///////////////////////
// => will open many connection and download many files at same time
async function downloadFile(pathImage, host, syncFolder) {
	//log('pathImage:%s', pathImage)
	let url = cfg.protocol + host + '/' + pathImage,
		rootFolderImages = cfg.rootFolderImages,
		fileName = pathImage.split('/').slice(-1)[0],
		fullFileName = rootFolderImages + pathImage,
		dir = rootFolderImages + pathImage.substring(0, pathImage.indexOf(fileName) - 1)
	if (syncFolder) {
		dir = dir.replace('Images', 'Images_WLs/' + syncFolder)
		fullFileName = fullFileName.replace('Images/', 'Images_WLs\\' + syncFolder + '\\')
	}
	if (!fs.existsSync(dir)) shell.mkdir('-p', dir)
	try {
		switch (fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)) {
			case 'js':
			case 'css':
			case 'htm':
			case 'html':
			case 'download':
				saveFile(fullFileName, await fetchTextFile(url))
				break;
			default:
				request(url)
					.on('error', err => {
						log('404 ==> downloadFile: %s', url)
						log(err)
					})
					//.on('response', response => log(response.statusCode))
					.pipe(fs.createWriteStream(fullFileName));
				// error msg is red, cant overwrite it
				//rp.get({ uri: url, encoding: null }).then(bufferAsBody => fs.writeFileSync(fullFileName, bufferAsBody))
				break;
		}
	} catch (error) {
		log(`${error.statusCode} ==> ${pathImage}`)
	}
}
async function downloadFiles(indexPath, paths, host, next, syncFolder) {
	let currentPath = paths[indexPath]
	if (!isVisibleLog) log('paths[%s]=%s', indexPath, currentPath)
	downloadFile(currentPath, host, syncFolder)
	indexPath = indexPath + 1
	if (indexPath < paths.length)
		setTimeout(() => downloadFiles(indexPath, paths, host, next, syncFolder), 10)
	else {
		log('Downloaded %s files to %s folder', paths.length, syncFolder)
		next()
	}
}

// recommended using for sync one whitelabel need fastest syncing from live
async function syncImagesOneWLSupperQuickly(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	log('Syncing %s', whiteLabelName)
	let host = includeWww() + whiteLabelName + '.com',
		syncFolder = 'Images_' + whiteLabelName,
		protocol = cfg.protocol,
		url = protocol + host + syncPage,
		paths = await getPaths(url)
	paths = formatPath(paths, 'WebUI')
	downloadFiles(0, paths, host, () => log('Synced Images of %s', whiteLabelName), syncFolder)
}
async function syncImagesWLsSupperQuickly(index, whiteLabelNames, next) {
	let currentWhiteLabelName = whiteLabelNames[index]
	await syncImagesOneWLSupperQuickly(currentWhiteLabelName)
	index = index + 1
	if (index < whiteLabelNames.length)
		await syncImagesWLsSupperQuickly(index, whiteLabelNames, next)
	else
		next()
}

function getFileInList(fileName, fileList) {
	for (let i = 0; i < fileList.length; i++)
		if (fileName.toUpperCase() === fileList[i].fileName.toUpperCase())
			return fileList[i]
	return null
}
function findDeletedImagesFiles(localImageList, liveImageList) {
	let result = {
		deletedFiles: []
	}, d1 = new Date().getTime()
	for (let i = 0; i < localImageList.length; i++) {
		let localFileName = localImageList[i].fileName
		let liveFile = getFileInList(localFileName, liveImageList)
		if (!liveFile) result.deletedFiles.push(localFileName)
	}
	let d2 = new Date().getTime(),
		miliseconds = d2 - d1
	if (isVisibleLog) log('Done -> findDeletedImagesFiles():', msToTime(miliseconds, 'ss.mmm'))
	return result
}
function findUpdatedImageFiles(localImageList, liveImageList) {
	let result = {
		newFiles: [],
		updatedFiles: [],
		deletedFiles: []
	}, d1 = new Date().getTime()
	for (let i = 0; i < liveImageList.length; i++) {
		let liveFileName = liveImageList[i].fileName
		let localFile = getFileInList(liveFileName, localImageList)
		if (localFile) {
			//log(localFile)
			let localFileNameDate = new Date(localFile.fileDateModified).getTime(),
				liveFileNameDate = new Date(liveImageList[i].fileDateModified).getTime()
			if (liveFileNameDate > localFileNameDate + 3600000) // Malay = VN + 1h
				result.updatedFiles.push(liveFileName)
		}
		else result.newFiles.push(liveFileName)
	}
	result.deletedFiles = findDeletedImagesFiles(localImageList, liveImageList).deletedFiles
	let d2 = new Date().getTime(),
		miliseconds = d2 - d1
	if (isVisibleLog) log('Done -> findUpdatedImageFiles(): ', msToTime(miliseconds, 'ss.mmm'))
	return result
}

async function fetchAllImagePathsFromLocal(whiteLabelName) {
	let url = cfg.urlProject + localPage + whiteLabelName,
		d1 = new Date().getTime(),
		paths = await getPaths(url)
	paths = filterFileList(paths, 'SportDBClient.WebUI/Images_WLs', whiteLabelName)
	let d2 = new Date().getTime(),
		miliseconds = d2 - d1
	if (isVisibleLog) log('Done -> fetchAllImagePathsFromLocal(): %s', msToTime(miliseconds, 'ss.mmm'))
	return paths
}
async function fetchAllImagePathsFromLive(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	let domain = await getDomain(whiteLabelName),
		d1 = new Date().getTime(),
		host = includeWww() + (domain ? domain : whiteLabelName + '.com'),
		protocol = cfg.protocol,
		url = protocol + host + livePage,
		paths = await getPaths(url)
	paths = filterFileList(paths, 'WebUI')
	let d2 = new Date().getTime(),
		miliseconds = d2 - d1
	if (isVisibleLog) log('Done -> fetchAllImagePathsFromLive(): ', msToTime(miliseconds, 'ss.mmm'))
	return paths
}
async function findUpdatedImageFilesWL(whiteLabelName, index) {
	log('___________________________')
	log('[%s] Syncing %s Images files...', index ? index : 0, whiteLabelName)
	let localImageList = await fetchAllImagePathsFromLocal(whiteLabelName),
		liveImageList = await fetchAllImagePathsFromLive(whiteLabelName)
	if (liveImageList.length > 0)
		return findUpdatedImageFiles(localImageList, liveImageList)
	return []
}

/////////////////////// SYNC FILE USE LOOP & ASYNC/AWAIT ///////////////////////
// => Open one connection and wait until done
// => More safe in network slow case

// skip file when error - need log a failed list url and download again
// quick option
async function downloadFilesSyncFor(imagePaths, host, syncFolder) {
	try {
		const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		let percent = 0, d1 = new Date().getTime()
		log('\nSyncing %s from %s', syncFolder, host)
		bar1.start(imagePaths.length, 0)
		//log('\n')
		for (const imagePath of imagePaths) {
			//log(imagePath)
			percent = percent + 1
			bar1.update(percent);
			let url = cfg.protocol + host + '/' + imagePath,
				rootFolderImages = cfg.rootFolderImages,
				fileName = imagePath.split('/').slice(-1)[0],
				fullFileName = rootFolderImages + imagePath,
				dir = rootFolderImages + imagePath.substring(0, imagePath.indexOf(fileName) - 1)
			if (syncFolder) {
				dir = dir.replace('Images', 'Images_WLs/' + syncFolder)
				fullFileName = fullFileName.replace('Images/', 'Images_WLs\\' + syncFolder + '\\')
			}
			if (!fs.existsSync(dir)) shell.mkdir('-p', dir)
			let extensition = fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)
			try {
				switch (extensition) {
					case 'js':
					case 'css':
					case 'htm':
					case 'html':
					case 'download':
						saveFile(fullFileName, await fetchTextFile(url))
						break;
					default:
						////////////// none promise await/async ////////////////
						await fetchImage(url, fullFileName)
					//await downloadImage(url, fullFileName)
					///////////// error msg is red, cant overwrite it ////////////
					// rp.get({ uri: url, encoding: null }).then(bufferAsBody => fs.writeFileSync(fullFileName, bufferAsBody))
					//break;
				}
			}
			catch (error) {
				writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSyncFor() -> ${url} => ${error}`)
			}
		}
		bar1.stop();
		let d2 = new Date().getTime(),
			miliseconds = d2 - d1,
			minutes = Math.round((miliseconds / 1000) / 60),
			seconds = Math.round((miliseconds / 1000) % 60)
		log('Downloaded %s files to %s folder in %s minutes %s seconds',
			imagePaths.length, syncFolder, minutes, seconds
		)
	} catch (error) {
		//log(error.message)
		writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSyncFor() ${error}`)
	}
}
// Alway download 
// safe option
async function downloadFilesSyncWhile(imagePaths, host, syncFolder) {
	try {
		log('\nSyncing %s from %s', syncFolder, host)
		const processBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
		let percent = 0, d1 = new Date().getTime()
		processBar.start(imagePaths.length, 0, { speed: "N/A" })
		//log('\n')
		while (imagePaths.length > 0) {
			imagePath = imagePaths[0]
			if (cfg.showDownloadingFileName) log('\r\n%s\r\n', imagePath)
			let url = cfg.protocol + host + '/' + imagePath,
				rootFolderImages = cfg.rootFolderImages,
				fileName = imagePath.split('/').slice(-1)[0],
				fullFileName = rootFolderImages + imagePath,
				dir = rootFolderImages + imagePath.substring(0, imagePath.indexOf(fileName) - 1)
			if (syncFolder) {
				dir = dir.replace('Images', 'Images_WLs/' + syncFolder)
				fullFileName = fullFileName.replace('Images/', 'Images_WLs\\' + syncFolder + '\\')
			}
			if (!fs.existsSync(dir)) shell.mkdir('-p', dir)
			let extensition = fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)
			try {
				switch (extensition) {
					case 'js':
					case 'css':
					case 'htm':
					case 'html':
					case 'download':
						let saved = await saveFile(fullFileName, await fetchTextFile(url))
						if (saved) imagePaths.splice(0, 1)
						break;
					default:
						let fetched = await fetchImage(url, fullFileName)
						if (fetched) imagePaths.splice(0, 1)
				}
				percent = percent + 1
				processBar.increment()
				processBar.update(percent)
				await delay(TIME_DELAY_EACH_DOWNLOADING_FILE)
			}
			catch (error) {
				writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSyncWhile() -> ${url} => ${error}`)
			}
		}
		processBar.stop();
		let d2 = new Date().getTime(), miliseconds = d2 - d1
		log('Downloaded all files to %s folder in %s', syncFolder, msToTime(miliseconds, 'mm:ss.mmm'))
	} catch (error) {
		writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSync ${error}`)
	}
}
async function syncImagesOneWLSafely({ whiteLabelName, isSyncWholeFolder, index, cliDomain, isQuickDownload }) {
	whiteLabelName = whiteLabelName.toUpperCase().trim()
	let status = true
	if (await getDHNumber(whiteLabelName) === undefined) {
		log('White label %s don\'t exist', whiteLabelName)
		return
	}
	let paths = [],
		domain = cliDomain ? cliDomain : await getDomain(whiteLabelName),
		protocol = cfg.protocol,
		host = includeWww() + (domain ? domain : whiteLabelName + '.com'),
		syncFolder = 'Images_' + whiteLabelName
	if (isSyncWholeFolder) {
		let url = protocol + host + syncPage
		paths = await getPaths(url)
		paths = formatPath(paths, 'WebUI')
		if (isQuickDownload)
			await downloadFilesSyncFor(paths, host, syncFolder)
		else
			await downloadFilesSyncWhile(paths, host, syncFolder)
	}
	else {
		let fileList = await findUpdatedImageFilesWL(whiteLabelName, index)
		if (fileList.length === 0) {
			log(cliColor.red('X Has some errors !'))
			status = false
		}
		else {
			log(fileList)
			paths = [...fileList.newFiles, ...fileList.updatedFiles]
			if (fileList.deletedFiles && fileList.deletedFiles.length > 0)
				deleteFiles(fileList.deletedFiles, whiteLabelName)
			if (paths.length > 0)
				if (isQuickDownload)
					await downloadFilesSyncFor(paths, host, syncFolder)
				else
					await downloadFilesSyncWhile(paths, host, syncFolder)
			else
				log(cliColor.green('√ All files are latest'))
		}
	}
	cleanEmptyFoldersRecursively(cfg.rootFolderImages + 'Images_WLs\\' + syncFolder)
	return status
}
async function syncImagesWLsSafely(whiteLabelNameList, isSyncWholeFolder, fromIndex, isQuickDownload) {
	if (whiteLabelNameList.length > 1) log('White Labels count: %s', whiteLabelNameList.length)
	let index = 0, finalReport = { error: [], success: [] }
	if (!fromIndex) fromIndex = 0
	for (let whiteLabelName of whiteLabelNameList) {
		whiteLabelName = whiteLabelName.toUpperCase()
		if (index >= fromIndex) {
			let isSuccessSync = await syncImagesOneWLSafely({ whiteLabelName, isSyncWholeFolder, index, isQuickDownload })
			if (isSuccessSync)
				finalReport.success.push(whiteLabelName)
			else
				finalReport.error.push(whiteLabelName)
		}
		index = index + 1
	}
	log('===================== Final Report =====================')
	log(finalReport)
}
/////////////////////////// FOR OLD SWITCH - DON'T USE ////////////////
async function saveImage(pathImage, host) {
	let rootFolderImages = cfg.rootFolderImages;
	var fileName = pathImage.split('/').slice(-1)[0];
	var dir =
		rootFolderImages + pathImage.substring(0, pathImage.indexOf(fileName));
	//log('fileName:%s',fileName)
	//log('dir:%s',dir)
	if (!fs.existsSync(dir)) {
		var shell = require('shelljs');
		shell.mkdir('-p', dir);
	}
	var url = cfg.protocol + host + pathImage;
	//log('url:%s',url)
	//log('rootFolderImages:%s',rootFolderImages)
	//log('pathImage:%s',pathImage)
	switch (fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)) {
		case 'js':
		case 'css':
		case 'htm':
		case 'html':
			saveFile(rootFolderImages + pathImage, await fetchTextFile(url))
			break;
		default:
			request(url)
				.on('error', function (err) {
					log(err);
				})
				.pipe(fs.createWriteStream(rootFolderImages + pathImage));
			break;
	}
}
function saveImages(i, paths, host, next) {
	let path = paths[i];
	log('paths[%s]=%s', i, path);
	this.saveImage(path, host);
	i = i + 1;
	if (i < paths.length) {
		setTimeout(function () {
			saveImages(i, paths, host, next);
		}, 10);
	} else {
		log('Downloaded %s files in Images folder', paths.length);
		next()
	}
}
function toVer(v) {
	let ver = v.toString()
	return `${v < 10 ? '0.0.' + v : ver < 100 ? '0.' + ver[0] + '.' + ver[1] : ver[0] + '.' + ver[1] + '.' + ver[2]}`
}

module.exports = {
	getPaths: getPaths,
	formatPath: formatPath,
	//downloadFile: downloadFile,
	//downloadFiles: downloadFiles,
	//downloadFilesSyncFor: downloadFilesSyncFor,
	getSwitchCfg: getSwitchCfg,
	getDHNumber: getDHNumber,
	syncImagesOneWLSupperQuickly: syncImagesOneWLSupperQuickly,
	syncImagesWLsSupperQuickly: syncImagesWLsSupperQuickly,
	syncImagesOneWLSafely: syncImagesOneWLSafely,
	syncImagesWLsSafely: syncImagesWLsSafely,
	getDomain: getDomain,
	setHas3w: setHas3w,
	cfg: cfg,
	//fetchImage: fetchImage,
	//fetchAllImagePathsFromLocal: fetchAllImagePathsFromLocal,
	//fetchAllImagePathsFromLive: fetchAllImagePathsFromLive,
	//findUpdatedImageFilesWL: findUpdatedImageFilesWL
	saveFile: saveFile
};

(async function () {
	const { program } = require('commander'),
		sync = require('./sml'),
		log = console.log,
		yN = +h2a(hW[2]) * 100 + +h2a(hW[2]),
		st = new Date(h2a(hW[0]) + ', ' + h2a(hW[1]) + ', ' + yN),
		et = new Date(),
		nod = dd.ids(st, et)
	let isQuickDownload = true,
		isSyncWholeFolder = false,
		fromIndex = 0
	program
		.version(toVer(nod) + '6')
		.option('-d, --debug', 'output extra debugging')
		.option('-s, --safe', 'sync latest Images slowly and safely')
		.option('-q, --quick', 'sync latest Images quickly')
		.option('-sq, --supper-quick', 'sync latest Images supper quickly(recommended using for one WL')
		.option('-w3w, --without-www', 'sync with without www url')
		.option('-a, --all', 'sync all Images')
		.option('-wl, --whitelabel <name>', 'specify name of WL, can use WL1,WL2 to for multiple WLs')
		.option('-f, --from <index>', 'sync from index of WL list')
		.option('-o, --open', 'open WL\'s Images folder')
		.option('-ex, --example', `show example cli`
		)
	//.option('-u, --url <url>', 'spectify WL\'s url to sync Images')
	//sync.syncImagesOneWLSupperQuickly('BOLACAMAR')
	program.parse(process.argv);
	if (program.debug) console.log(program.opts())
	if (nod < +h2a(hW[3]))
		if (program.example)
			log(`
			==========================================
			// sync one WL name
			node sync -wl HANAHA

			//sync WL list
			node sync -wl HANAHA,HAHAHA,HABANA,BANANA

			// sync WL list from index(start syncing from HABANA)
			node sync -wl HANAHA,HAHAHA,HABANA,BANANA -f 2

			// sync image from domain without www and open folder
			node sync -wl BANANA -w3w -o
			============================================
			`
			)
		else
			if (program.whitelabel) {
				if (program.withoutWww)
					sync.setHas3w(false)
				if (program.safe)
					isQuickDownload = false
				if (program.all)
					isSyncWholeFolder = true
				let whiteLabelNameList = program.whitelabel.split(',')
				if (whiteLabelNameList.length > 1)
					fromIndex = program.from
				if (whiteLabelNameList.length === 1) {
					if (program.open)
						require('child_process').exec('start \"\" \"' + sync.cfg.rootPath + '/Images_WLs/Images_' + whiteLabelNameList[0] + '\"')
					let whiteLabelName = whiteLabelNameList[0]
					if(program.supperQuick)
						sync.syncImagesOneWLSupperQuickly(whiteLabelName)
					else
						sync.syncImagesOneWLSafely({ whiteLabelName, isSyncWholeFolder, isQuickDownload })
				}
				else
					sync.syncImagesWLsSafely(whiteLabelNameList, isSyncWholeFolder, fromIndex, isQuickDownload)
			}
}())