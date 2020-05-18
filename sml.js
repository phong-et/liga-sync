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
	livePage = "/pgajax.axd?T=GetImages"
isLog = false,
	cliProgress = require('cli-progress')

const TIME_DELAY_EACH_DOWNLOADING_FILE = 1000;
async function saveFile(fileName, content) {
	return new Promise((resolve, reject) => {
		fs.writeFile(fileName, content, function (err) {
			if (err) reject(err)
			resolve(true)
		})
	})
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
//0.02 mls
function getFileName(fullPath) {
	return fullPath.split('/').pop().split('/').pop();
}
function getFileExtension(fullPath) {
	return fullPath.split('.').pop()
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
async function downloadImage(url, fullFileName) {
	return new Promise((resolve) => {
		rp.head(url, (error, _, _) => {
			if (error) writeLog(`${new Date().toLocaleString('vi-VN')}: downloadImage.request.head -> ${url} -> ${error}`)
			else {
				try {
					rp(url, (error, _, _) => {
						if (error) writeLog(`${new Date().toLocaleString('vi-VN')}: downloadImage.request.head.request: -> ${url} -> ${error}`)
					}).pipe(
						fs.createWriteStream(fullFileName)
							.on("error", (error) => writeLog(`${new Date().toLocaleString('vi-VN')}: downloadImage.request.head.request.fs.createWriteStream: -> ${url} -> ${error}`))
							.on('close', writeStream.on('finish', resolve))
					).on("error", (error) => writeLog(`${new Date().toLocaleString('vi-VN')}: downloadImage.request.head.request.pipe: -> ${url} -> ${error}`))

				} catch (error) {
					writeLog(`${new Date().toLocaleString('vi-VN')}: downloadImage %s error fs.createWriteStream: -> ${url} -> ${error}`)
				}
			}
		})
	})
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
	await downloadFile(currentPath, host, syncFolder);
	indexPath = indexPath + 1
	if (indexPath < paths.length)
		setTimeout(async () => await downloadFiles(indexPath, paths, host, next, syncFolder), TIME_DELAY_EACH_DOWNLOADING_FILE);
	else {
		log("Downloaded %s files to %s folder", paths.length, syncFolder);
		next()
	}
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
// save image to Images_WLs\Images_<WhiteLabelName>
async function syncImagesWL(whiteLabelName) {
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
async function syncImagesWLs(index, whiteLabelNames, next) {
	let currentWhiteLabelName = whiteLabelNames[index]
	await syncImagesWL(currentWhiteLabelName)
	index = index + 1
	if (index < whiteLabelNames.length)
		await syncImagesWLs(index, whiteLabelNames, next)
	else
		next()
}
async function delay(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}
async function downloadFilesSync(imagePaths, host, syncFolder) {
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
				writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSync.for -> ${url} => ${error}`)
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
		writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSync ${error}`)
	}
}
async function downloadFilesSyncLoop(imagePaths, host, syncFolder) {
	try {
		const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		let percent = 0, d1 = new Date().getTime()
		log('\nSyncing %s from %s', syncFolder, host)
		bar1.start(imagePaths.length, 0)
		//log('\n')
		while (imagePaths.length > 0) {
			imagePath = imagePaths[0]
			//log('\r\n%s\r\n', imagePath)
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
				writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSyncLoop.for -> ${url} => ${error}`)
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
		writeLog(`${new Date().toLocaleString('vi-VN')}: downloadFilesSync ${error}`)
	}
}
async function syncImagesOneWL(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	let domain = await getDomain(whiteLabelName)
	host = 'www.' + (domain ? domain : whiteLabelName + '.com'),
		syncFolder = 'Images_' + whiteLabelName,
		protocol = cfg.protocol,
		url = protocol + host + syncPage,
		paths = await getPaths(url)
	paths = formatPath(paths, 'WebUI')
	await downloadFilesSyncLoop(paths, host, syncFolder)
}
async function syncImagesAllWLs(whiteLabelNameList) {
	for (let name of whiteLabelNameList)
		await syncImagesOneWL(name)
}
async function fetchAllImagePathsFromLocal(whiteLabelName) {
	let url = cfg.urlProject + localPage + whiteLabelName,
		paths = await getPaths(url)
	return paths
}
async function fetchAllImagePathsFromLive(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	let domain = await getDomain(whiteLabelName),
		host = 'www.' + (domain ? domain : whiteLabelName + '.com'),
		protocol = cfg.protocol,
		url = protocol + host + livePage,
		paths = await getPaths(url)
	return paths
}
function isLocalFileExist(liveFileName, fileList) {
	for (let i = 0; i < fileList.length; i++) {
		let localFileName = getFileName(fileList[i].fileName)
		log('%s -> %s', liveFileName, localFileName)
		if(liveFileName === localFileName)
			return true
	}
	return false
}
function compareLocalAndLiveFile(localFileNameDate, liveFileNameDate){

}

function findNewImageFiles(localImageList, liveImageList) {
	let result = {
		newFiles: [],
		updatedFiled: []
	}
	for (let i = 0; i < liveImageList.length; i++) {
		let liveFileName = getFileName(liveImageList[i].fileName)
		if (isLocalFileExist(liveFileName, localImageList)){
			localFileNameDate = localImageList[i].fileDateModified,
			liveFileNameDate = liveImageList[i].fileDateModified
			result.updatedFiled.push(liveFileName)
		}
		else result.newFiles.push(liveFileName)
		//log(`${fileName} -> [Local]:${localFileNameDate} & [Live]: ${liveFileNameDate}`)
	}
	log(result)
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
	downloadFilesSync: downloadFilesSync,
	getSwitchCfg: getSwitchCfg,
	getDHNumber: getDHNumber,
	//syncImagesWL: syncImagesWL,
	//syncImagesWLs: syncImagesWLs,
	syncImagesOneWL: syncImagesOneWL,
	syncImagesAllWLs: syncImagesAllWLs,
	getDomain: getDomain,
	fetchImage: fetchImage,
	fetchAllImagePathsFromLocal: fetchAllImagePathsFromLocal,
	fetchAllImagePathsFromLive: fetchAllImagePathsFromLive,
	findNewImageFiles: findNewImageFiles
};