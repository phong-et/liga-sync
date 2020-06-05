function cleanEmptyFoldersRecursively(folder) {
    var fs = require('fs');
    var path = require('path');

    var isDir = fs.statSync(folder).isDirectory();
    if (!isDir) {
      return;
    }
    var files = fs.readdirSync(folder);
    if (files.length > 0) {
      files.forEach(function(file) {
        var fullPath = path.join(folder, file);
        cleanEmptyFoldersRecursively(fullPath);
      });

      // re-evaluate files; after deleting subfolder
      // we may have parent folder empty now
      files = fs.readdirSync(folder);
    }

    if (files.length == 0) {
      //console.log("removing: ", folder);
      fs.rmdirSync(folder);
      return;
    }
  }
  cleanEmptyFoldersRecursively('H:\\Projects\\LIGA_New_v8_Live\\SportDBClient.WebUI\\Images_WLs\\Images_<name>')