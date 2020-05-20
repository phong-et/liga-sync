let cfg = require('./switch.cfg'),
	log = console.log,
	shell = require("shelljs"),
	rp = require('request-promise'),
	request = require('request'),
	fs = require('fs'),
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
	syncPage = "/pgajax.axd?T=SyncImages",
	localPage = "pgajax.axd?T=GetWLImages&name=",
	livePage = "/pgajax.axd?T=GetImages",
	isLog = false,
	cliProgress = require('cli-progress')

const TIME_DELAY_EACH_DOWNLOADING_FILE = 1000

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
			if (err) reject(err)
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
	log(url)
	try {
		let options = {
			uri: url,
			headers: headers,
			resolveWithFullResponse: true,
			transform: function (body) {
				return body.replace(/\\/g, "/");
			}
		}
		if (isLog) log("Get Paths: %s", url);
		var paths = await rp(options)
		paths = JSON.parse(paths)
		return paths;
	} catch (error) {
		log(error)
		if (error.message.indexOf('getaddrinfo'))
			log('======> DOMAIN %s don\'t exist', error.cause.hostname)
		return []
	}
}
/**
* stringSplit(Images,C:\\...)
*/
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
async function downloadOneFile(pathImage, host, syncFolder) {
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
						log('404 ==> fetchTextFile: %s', url)
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
	let currentPath = paths[indexPath];
	if (isLog) log("paths[%s]=%s", indexPath, currentPath);
	await downloadOneFile(currentPath, host, syncFolder);
	indexPath = indexPath + 1
	if (indexPath < paths.length)
		setTimeout(async () => await downloadFiles(indexPath, paths, host, next, syncFolder), TIME_DELAY_EACH_DOWNLOADING_FILE);
	else {
		log("Downloaded %s files to %s folder", paths.length, syncFolder);
		next()
	}
}
async function syncImagesOneWLQuickly(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	log('Syncing %s', whiteLabelName)
	let host = 'www.' + whiteLabelName + '.com',
		syncFolder = 'Images_' + whiteLabelName,
		protocol = cfg.protocol,
		url = protocol + host + syncPage,
		paths = await getPaths(url)
	paths = formatPath(paths, 'WebUI')
	downloadFiles(0, paths, host, () => log('Synced Images of %s', whiteLabelName), syncFolder)
}
async function syncImagesWLsQuickly(index, whiteLabelNames, next) {
	let currentWhiteLabelName = whiteLabelNames[index]
	await syncImagesOneWLQuickly(currentWhiteLabelName)
	index = index + 1
	if (index < whiteLabelNames.length)
		await syncImagesWLs(index, whiteLabelNames, next)
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
		miliseconds = d2 - d1,
		minutes = Math.round((miliseconds / 1000) / 60),
		seconds = Math.round((miliseconds / 1000) % 60)
	log("Done -> findDeletedImagesFiles(): %s minutes %s seconds %s miliseconds", minutes, seconds, miliseconds)
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
		miliseconds = d2 - d1,
		minutes = Math.round((miliseconds / 1000) / 60),
		seconds = Math.round((miliseconds / 1000) % 60)
	log("Done -> findUpdatedImageFiles(): %s minutes %s seconds %s miliseconds", minutes, seconds, miliseconds)
	return result
}

async function fetchAllImagePathsFromLocal(whiteLabelName) {
	let url = cfg.urlProject + localPage + whiteLabelName,
		paths = await getPaths(url)
	paths = filterFileList(paths, 'SportDBClient.WebUI/Images_WLs', whiteLabelName)
	return paths
}
async function fetchAllImagePathsFromLive(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	let domain = await getDomain(whiteLabelName),
		host = 'www.' + (domain ? domain : whiteLabelName + '.com'),
		protocol = cfg.protocol,
		url = protocol + host + livePage,
		paths = await getPaths(url)
	paths = filterFileList(paths, 'WebUI')
	return paths
}
async function findUpdatedImageFilesWL(whiteLabelName) {
	log('___________________________')
	log('Checking %s Images files...', whiteLabelName)
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
		log("Downloaded %s files to %s folder in %s minutes %s seconds",
			imagePaths.length, syncFolder, minutes, seconds
		)
	} catch (error) {
		//log(error.message)
		writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSyncFor() ${error}`)
	}
}
// Alway download 
async function downloadFilesSyncWhile(imagePaths, host, syncFolder) {
	try {
		const processBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		let percent = 0, d1 = new Date().getTime()
		log('\nSyncing %s from %s', syncFolder, host)
		processBar.start(imagePaths.length, 0)
		//log('\n')
		while (imagePaths.length > 0) {
			imagePath = imagePaths[0]
			//log('\r\n%s\r\n', imagePath)
			percent = percent + 1
			processBar.update(percent);
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
				await delay(TIME_DELAY_EACH_DOWNLOADING_FILE)
			}
			catch (error) {
				writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSyncWhile() -> ${url} => ${error}`)
			}
		}
		processBar.stop();
		let d2 = new Date().getTime(),
			miliseconds = d2 - d1,
			minutes = Math.round((miliseconds / 1000) / 60),
			seconds = Math.round((miliseconds / 1000) % 60)
		log("Downloaded all files to %s folder in %s minutes %s seconds", syncFolder, minutes, seconds
		)
	} catch (error) {
		writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSync ${error}`)
	}
}
async function syncImagesOneWLSafely({ whiteLabelName, isSyncWholeFolder }) {
	whiteLabelName = whiteLabelName.toUpperCase()
	let paths = [],
		domain = await getDomain(whiteLabelName),
		protocol = cfg.protocol,
		host = 'www.' + (domain ? domain : whiteLabelName + '.com'),
		syncFolder = 'Images_' + whiteLabelName
	if (isSyncWholeFolder) {
		let url = protocol + host + syncPage
		paths = await getPaths(url)
		paths = formatPath(paths, 'WebUI')
	}
	else {
		let fileList = await findUpdatedImageFilesWL(whiteLabelName)
		if (fileList.length === 0)
			log('Has error pls check msg')
		else {
			log(fileList)
			paths = [...fileList.newFiles, ...fileList.updatedFiles]
			if (fileList.deletedFiles && fileList.deletedFiles.length > 0)
				deleteFiles(fileList.deletedFiles, whiteLabelName)
			if (paths.length > 0)
				await downloadFilesSyncWhile(paths, host, syncFolder)
			else log('All files are latest')
		}
	}
}
async function syncImagesWLsSafely(whiteLabelNameList) {
	for (let name of whiteLabelNameList)
		await syncImagesOneWLSafely({ whiteLabelName: name })
}
/////////////////////////// FOR OLD SWITCH ////////////////
async function saveImage(pathImage, host) {
	let rootFolderImages = cfg.rootFolderImages;
	var fileName = pathImage.split("/").slice(-1)[0];
	var dir =
		rootFolderImages + pathImage.substring(0, pathImage.indexOf(fileName));
	//log('fileName:%s',fileName)
	//log('dir:%s',dir)
	if (!fs.existsSync(dir)) {
		var shell = require("shelljs");
		shell.mkdir("-p", dir);
	}
	var url = cfg.protocol + host + pathImage;
	//log('url:%s',url)
	//log('rootFolderImages:%s',rootFolderImages)
	//log('pathImage:%s',pathImage)
	switch (fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)) {
		case "js":
		case "css":
		case "htm":
		case "html":
			saveFile(rootFolderImages + pathImage, await fetchTextFile(url))
			break;
		default:
			request(url)
				.on("error", function (err) {
					log(err);
				})
				.pipe(fs.createWriteStream(rootFolderImages + pathImage));
			break;
	}
}
async function saveImages(i, paths, host, next) {
	let path = paths[i];
	log("paths[%s]=%s", i, path);
	this.saveImage(path, host);
	i = i + 1;
	if (i < paths.length) {
		setTimeout(function () {
			saveImages(i, paths, host, next);
		}, 10);
	} else {
		log("Downloaded %s files in Images folder", paths.length);
		next()
	}
}
module.exports = {
	getPaths: getPaths,
	formatPath: formatPath,
	//downloadFile: downloadFile,
	//downloadFiles: downloadFiles,
	//downloadFilesSyncFor: downloadFilesSyncFor,
	getSwitchCfg: getSwitchCfg,
	getDHNumber: getDHNumber,
	//syncImagesWL: syncImagesWL,
	syncImagesWLsQuickly: syncImagesWLsQuickly,
	//syncImagesOneWL: syncImagesOneWL,
	syncImagesWLsSafely: syncImagesWLsSafely,
	getDomain: getDomain,
	//fetchImage: fetchImage,
	//fetchAllImagePathsFromLocal: fetchAllImagePathsFromLocal,
	//fetchAllImagePathsFromLive: fetchAllImagePathsFromLive,
	//findUpdatedImageFilesWL: findUpdatedImageFilesWL
};