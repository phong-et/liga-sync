﻿# liga-sync

# Bugs 
1. http://prntscr.com/sjax7c (process bar break down)
2. Download file list by while loop, looping can not end with server without any file ???
3. By adding try catch, program will be stopped although return statement called why ?

# CLI screen results
1. http://prntscr.com/sjdxpv1 (hasn't log = 0 seconds)
2. http://prntscr.com/sjdyr11(has log 14s)
3. http://prntscr.com/sjg85f1 list final
4. https://prnt.sc/sjh10c1 Synced latest files
5. http://prntscr.com/sjhq7e1 Done aync multi WL
6. http://prntscr.com/sjldl41 Deleted files after synced
7. http://prntscr.com/sk3de31 Sometimes files are missed out. Sometime, the servers don't sync together latest file
8. http://prntscr.com/srhj101 Sync Images with index of WL list
9. http://prntscr.com/su3l701 ".download" file type don't define at MINETYPE IIS -> download failed
10. http://prntscr.com/ta65bx1 latest final report 

# CLI arguments
    -V, --version             output the version number
    -d, --debug               output extra debugging
    -h, --help                display help for command  
    -awls, --all-whitelabels  sync all Images in WL list
    -wl, --whitelabel <name>  specify name of WL, can use WL1,WL2 to for multiple WLs
       - Sub options of -wl <name>:
            -s, --safe           sync latest Images slowly and safely
            -q, --quick          sync latest Images quickly(is default)
            -sq, --supper-quick  sync latest Images supper quickly (Recommeded using for one WL)
            -www, --www          sync with www url
            -http, --http',      sync with http protocol
            -a, --all            sync all Images
            -f, --from <index>   sync from index of WL list
            -o, --open           open WL's Images folder
        
    
# Sample statements
```js
// sync one WL name
node sync -wl HANAHA

//sync WL list
node sync -wl HANAHA,HAHAHA,HABANA,BANANA

// sync WL list from index(start syncing from HABANA)
node sync -wl HANAHA,HAHAHA,HABANA,BANANA -f 2

// sync image from domain include www and open folder
node sync -wl BANANA -www -o 

// sync image by url: http://www. + domain supper quickly then open folder Image too
node sync -wl BANANA -www -http -sp -o 

```
# Knowledge
1. Remove emty folder by recursive algorithm 
    - https://gist.github.com/jakub-g/5903dc7e4028133704a4 normal
    - https://gist.github.com/fixpunkt/fe32afe14fbab99d9feb4e8da7268445 promise

# Note 
Sync command line of test site 
```js
node sml -wl BANANA -url bananamain.playplay.com -http -a
```

# Change log
All notable changes to this project will be documented in this part.
## [0.0.8]
### Fixed
- sync all white labels list can be use -f option together
  ```js
  // start sycing from white lable has index is 15
  node sync -awls -f 15

  ```
- **-log** option (don't show log when add -log)

### Added
- **-url**/**--url** option : sync with specific url, only use for one white label
- **-log**/**--log** option : enable log console
### Changed
- **awls** to **allwls**

## [0.0.7]
### Added
- Final Report 
    ```js 
    {
        total: 7,
        latest: [ '5 White Labels' ],
        changed: ['BANANA'],
        error: [ 'HABANA' ] 
    }
    ```
- **-awls**/**--all-whitelabels** option
- Sync all WLs in active WL list from WLs.json (included w3w & www)
- Should add more **--open** option to view ensure image synced then type WL's switching command line.
    ```js
    // implicit option
    node sync -awls
    // explicit option
    node sync --all-whitelabels
    ```
- **-www**/**--www** option : sync with www url'
- **-http/--http** option : sync with http protocol
### Changed
- **hasWww = false** is default

## [0.0.6]
### Fixed bugs 
- Fixed program is stopped by deleting file not found
- Final Report list WLs are updated images to Error list
### Added
- **--sq**/**--supper-quick** option
- Recommended using for sync one WL with empty WL's images folder case
- Should add more **--open** option to view ensure image synced then type WL's switching command line.
    ```js
    // implicit option
    node sync -wl BANANA -sq -o
    // explicit option
    node sync -wl BANANA --supper-quick --open
    ```
## [0.0.5]
### Fixed bugs 
- Uppercase whitelabel name 
### Added
- Final Report
### Changed
- **quick** is default sync, disable quick by add -s/--safe

## [0.0.4]
### Fixed bugs 
- Trim space whitelabel name 
- **--all** option 
- Process bar 
- Remove all empty folders after syncing completed 

### Added
- **deplayTime** prop at switch.cfg
- **showDownloadingFileName** prop at switch.cfg
- **--quick** option 
- Final Report
### Changed
- **quick** is default sync, disable quick mode by add -s/--safe

## 0.0.1 - 2020-6-1
 - 1st release
