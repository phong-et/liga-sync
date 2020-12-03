const JavaScriptObfuscator = require('javascript-obfuscator'),
  fs = require('fs'),
  log = console.log;

function build(fileName) {
  var code = fs.readFileSync(fileName, 'utf8');
  log(code);
  var obfuscationResult = JavaScriptObfuscator.obfuscate(code);
  log(obfuscationResult);
  fs.writeFile('build/' + fileName, obfuscationResult, function (err) {
    if (err) log(err);

    log('build/' + fileName + ' was save');
  });
  // var result = UglifyJS.minify(code);
  // console.log(result.error); // runtime error, or `undefined` if no error
  // console.log(result.code);  // minified output: function add(n,d){return n+d}
}
build('sml.js');
