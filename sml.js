let cfg = require('./switch.cfg'),
	log = console.log,
	shell = require("shelljs"),
	rp = require('request-promise'),
	request = require('request'),
	fs = require('fs'),
	headers = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36",
		"Content-type": "text/html"
	},
	headersGzip = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36',
		'Content-type': 'text/html',
		'Accept-Encoding': 'gzip, deflate'
	},
	page = "/pgajax.axd?T=SyncImages",
	isLog = false,
	cliProgress = require('cli-progress');

const TIME_DELAY_EACH_DOWNLOADING_FILE = 1000;
async function saveFile(fileName, content) {
	return new Promise((resolve, reject) => {
		fs.writeFile(fileName, content, function (err) {
			if (err) reject(err)
			resolve(true)
		})
	})
}
async function getPaths(host, stringSplit) {
	let protocol = cfg.protocol,
		url = protocol + host + page,
		options = {
			uri: url,
			headers: headers,
			resolveWithFullResponse: true,
			transform: function (body) {
				return body.replace(/\\/g, "/");
			}
		}
	if (isLog) log("Get Paths: %s", url);
	var paths = await rp(options)
	paths = JSON.parse(paths);
	paths = formatPath(paths, stringSplit);
	return paths;
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
	return fullPath.split('\\').pop().split('/').pop();
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
		log(`Message=${error.message.substring(0, 3)} ==> fetchTextFile:${url}`)
	}
}

async function fetchImage(url, fullFileName) {
	return new Promise((resolve) => {
		let writeStream = fs.createWriteStream(fullFileName);
		request(url)
			.on('error', err => {
				log('404 ==> fetchTextFile: %s', url)
				log(err)
			})
			.pipe(writeStream)
		writeStream.on('finish', resolve);
	});
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
		paths = await getPaths(host, 'WebUI')
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
async function downloadFilesSync(imagePaths, host, syncFolder) {
	const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	let percent = 0, d1 = new Date().getTime()
	bar1.start(imagePaths.length, 0);
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
		switch (fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)) {
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
				///////////// error msg is red, cant overwrite it ////////////
				// rp.get({ uri: url, encoding: null }).then(bufferAsBody => fs.writeFileSync(fullFileName, bufferAsBody))
				break;
		}
	}
	bar1.stop();
	let d2 = new Date().getTime(),
		miliseconds = d2 - d1,
		minutes = Math.floor(miliseconds / 1000) / 60,
		seconds = (miliseconds / 1000) % 60
	log("Downloaded %s files to %s folder in %s minutes %s seconds",
		imagePaths.length, syncFolder, minutes, seconds
	);
}
async function syncImagesWLNew(whiteLabelName) {
	whiteLabelName = whiteLabelName.toUpperCase()
	log('Syncing %s', whiteLabelName)
	let domain = await getDomain(whiteLabelName)
	host = 'www.' + domain ? domain : whiteLabelName + '.com',
		syncFolder = 'Images_' + whiteLabelName,
		paths = await getPaths(host, 'WebUI')
	await downloadFilesSync(paths, host, syncFolder)
}

module.exports = {
	getPaths: getPaths,
	formatPath: formatPath,
	downloadFile: downloadFile,
	downloadFiles: downloadFiles,
	downloadFilesSync: downloadFilesSync,
	getSwitchCfg: getSwitchCfg,
	getDHNumber: getDHNumber,
	syncImagesWL: syncImagesWL,
	syncImagesWLs: syncImagesWLs,
	syncImagesWLNew: syncImagesWLNew,
	getDomain: getDomain
};