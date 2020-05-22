# liga-sync

# Bugs 
1. http://prntscr.com/sjax7c (process bar break down)
2. murni, rajaonline without www

# CLI Screen Results
1. http://prntscr.com/sjdxpv1 (hasn't log = 0 seconds)
2. http://prntscr.com/sjdyr11(has log 14s)
3. http://prntscr.com/sjg85f1 list final
4. https://prnt.sc/sjh10c1 Synced latest files
5. http://prntscr.com/sjhq7e1 Done aync multi WL
6. http://prntscr.com/sjldl4 Deleted files after Synced
7. http://prntscr.com/sk3de3 Sometimes files are missed out. Sometime, the servers don't sync together latest file

# CLI argument 
- ```node sync WHITE_LABEL --safe --open --without-www``` 
    ***OR***
  ``` node sync WHITE_LABEL -s -o -w3w```

- ```node sync WHITE_LABEL --quick``` 
   ***OR***
  ```node sync WHITE_LABEL -q```

    + --w3w/-w : without **www**
    + --open/-o : open folder Images of WHITE_LABEL
    + --safe/-s : download slowly and safely (as default)
    + --quick/-q : download quickly 
