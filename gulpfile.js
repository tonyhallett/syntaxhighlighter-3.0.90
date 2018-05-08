var gulp = require('gulp');
var gulpMerge=require('merge2');
var gulpSass=require('gulp-sass');
var gulpUglify=require('gulp-uglify');
var gulpUglifyCss=require('gulp-uglifycss');
var gulpRename=require('gulp-rename');
var gulpInsert=require('gulp-insert');
var clone = require('gulp-clone');
var gulpChange=require('gulp-change');


var del = require('del');
var path=require('path');
var fs=require('fs');
var shelljs= require('shelljs');
var minimatch = require('minimatch');
var ejs = require('ejs');


var baseDir       = __dirname;
var outDirName="pkg";
var componentsDir = path.resolve(baseDir,'components');
var includesDir   = path.resolve(baseDir,'build/includes');
var sourceDir=path.resolve(baseDir,'src');
var sourceSassDir=path.resolve(sourceDir,'sass');


//#region helpers
function isDirectory(dir){ 
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}
function readFile(filename){
 return fs.readFileSync(filename, 'utf8');
}
function findFilesIn(dir, pattern){
  return shelljs.find(dir)
    .filter(function (file){
      return minimatch(file, pattern, {matchBase: true});
    })
    .filter(function (file){
      return !isDirectory(file);
    });
}

//#endregion


function createEjsVariables(){
    var results = {};
    function loadFilesIntoVariables(){
        var includeFiles=findFilesIn(includesDir,'*.*');
        for(var i=0;i<includeFiles.length;i++){
            var includeFile=includeFiles[i];
            varName = path.basename(includeFile, path.extname(includeFile));
            results[varName] = readFile(includeFile);
        }
        return results;
        
    }
    loadFilesIntoVariables();
    results.version = JSON.parse(readFile(path.resolve(baseDir, './package.json'))).version;
    results.date    = new Date().toUTCString();
    results.about   = results.about.replace(/\r|\n|\t/g, "").replace(/"/g, "\\\"");
    return results;
}
function getHeader(variables){
    //version and date from variables
    return ejs.render(variables.header, variables);
}

var variables=createEjsVariables();
var header=getHeader(variables);

function build(){
    function clean() {
        return del([ outDirName]);
    }
    function copyIndexHtml(){
        //not really necessary !
        return gulp.src("build/index.html").pipe(gulp.dest(outDirName));
    }

    function getJs(){
        function shCore(){
            variables.about = ejs.render(variables.about, variables);
            var xregexpSource   = readFile(path.join(componentsDir, 'xregexp', 'src', 'xregexp.js'));
            return gulp.src("src/js/shCore.js").pipe(gulpChange(function(content){
                return xregexpSource + ejs.render(content, variables);
            }));
        }
        function jsExceptShCore(){
            return gulp.src(["src/js/**","!src/js/shCore.js"]);
        }
        return gulpMerge(shCore(),jsExceptShCore());
    }
    function compileSass(){
        return gulp.src(["src/sass/*.scss","!src/sass/_theme_template.scss"])
            .pipe(gulpSass({outputStyle:null,includePaths:sourceSassDir}));
    }

    function uglifyCssOrJs(jsOrCss,uglifyPlugin){
        var cloneSink=clone.sink();
        return jsOrCss
            .pipe(cloneSink)
            .pipe(uglifyPlugin)
            .pipe(gulpRename(function(path){
                if(path.basename&&path.basename!=""){
                    path.basename+=".min";
                }
            }))
            .pipe(cloneSink.tap());
            
    }
    function buildJsAndCss(){
        return gulpMerge(uglifyCssOrJs(getJs(),gulpUglify()),uglifyCssOrJs(compileSass(),gulpUglifyCss()))
            .pipe(gulpInsert.prepend(header)).pipe(gulp.dest(outDirName));
    }

    return clean().then(function(){ gulp.parallel(buildJsAndCss,copyIndexHtml)();});

    
}

exports.default=build;