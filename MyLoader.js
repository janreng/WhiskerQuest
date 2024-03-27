var myGameInstance = null;

function createUnityInstance(canvas, config, onProgress) {
  onProgress = onProgress || function () {};

  function errorListener(e) {
    var error = e.type == "unhandledrejection" && typeof e.reason == "object" ? e.reason : typeof e.error == "object" ? e.error : null;
    var message = error ? error.toString() : typeof e.message == "string" ? e.message : typeof e.reason == "string" ? e.reason : "";
    if (error && typeof error.stack == "string")
      message += "\n" + error.stack.substring(!error.stack.lastIndexOf(message, 0) ? message.length : 0).replace(/(^\n*|\n*$)/g, "");
    if (!message || !Module.stackTraceRegExp || !Module.stackTraceRegExp.test(message))
      return;
    var filename =
      e instanceof ErrorEvent ? e.filename :
      error && typeof error.fileName == "string" ? error.fileName :
      error && typeof error.sourceURL == "string" ? error.sourceURL :
      "";
    var lineno =
      e instanceof ErrorEvent ? e.lineno :
      error && typeof error.lineNumber == "number" ? error.lineNumber :
      error && typeof error.line == "number" ? error.line :
      0;
    errorHandler(message, filename, lineno);
  }

  var Module = {
    canvas: canvas,
    webglContextAttributes: {
      preserveDrawingBuffer: false,
    },
    streamingAssetsUrl: "StreamingAssets",
    downloadProgress: {},
    deinitializers: [],
    intervals: {},
    setInterval: function (func, ms) {
      var id = window.setInterval(func, ms);
      this.intervals[id] = true;
      return id;
    },
    clearInterval: function(id) {
      delete this.intervals[id];
      window.clearInterval(id);
    },
    preRun: [],
    postRun: [],
    print: function (message) {
      console.log(message);
    },
    printErr: function (message) {
      console.error(message);
    },
    locateFile: function (url) {
      return (
        url
      );
    },
    disabledCanvasEvents: [
      "contextmenu",
      "dragstart",
    ],
  };

  for (var parameter in config)
    Module[parameter] = config[parameter];

  Module.streamingAssetsUrl = new URL(Module.streamingAssetsUrl, document.URL).href;

  // Operate on a clone of Module.disabledCanvasEvents field so that at Quit time
  // we will ensure we'll remove the events that we created (in case user has
  // modified/cleared Module.disabledCanvasEvents in between)
  var disabledCanvasEvents = Module.disabledCanvasEvents.slice();

  function preventDefault(e) {
    e.preventDefault();
  }

  disabledCanvasEvents.forEach(function (disabledCanvasEvent) {
    canvas.addEventListener(disabledCanvasEvent, preventDefault);
  });

  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", errorListener);

  var unityInstance = {
    Module: Module,
    SetFullscreen: function () {
      if (Module.SetFullscreen)
        return Module.SetFullscreen.apply(Module, arguments);
      Module.print("Failed to set Fullscreen mode: Player not loaded yet.");
    },
    SendMessage: function () {
      if (Module.SendMessage)
        return Module.SendMessage.apply(Module, arguments);
      Module.print("Failed to execute SendMessage: Player not loaded yet.");
    },
    Quit: function () {
      return new Promise(function (resolve, reject) {
        Module.shouldQuit = true;
        Module.onQuit = resolve;

        // Clear the event handlers we added above, so that the event handler
        // functions will not hold references to this JS function scope after
        // exit, to allow JS garbage collection to take place.
        disabledCanvasEvents.forEach(function (disabledCanvasEvent) {
          canvas.removeEventListener(disabledCanvasEvent, preventDefault);
        });
        window.removeEventListener("error", errorListener);
        window.removeEventListener("unhandledrejection", errorListener);
      });
    },
  };

  Module.SystemInfo = (function () {

    var browser, browserVersion, os, osVersion, canvas, gpu;

    var ua = navigator.userAgent + ' ';
    var browsers = [
      ['Firefox', 'Firefox'],
      ['OPR', 'Opera'],
      ['Edg', 'Edge'],
      ['SamsungBrowser', 'Samsung Browser'],
      ['Trident', 'Internet Explorer'],
      ['MSIE', 'Internet Explorer'],
      ['Chrome', 'Chrome'],
      ['Safari', 'Safari'],
    ];

    function extractRe(re, str, idx) {
      re = RegExp(re, 'i').exec(str);
      return re && re[idx];
    }
    for(var b = 0; b < browsers.length; ++b) {
      browserVersion = extractRe(browsers[b][0] + '[\/ ](.*?)[ \\)]', ua, 1);
      if (browserVersion) {
        browser = browsers[b][1];
        break;
      }
    }
    if (browser == 'Safari') browserVersion = extractRe('Version\/(.*?) ', ua, 1);
    if (browser == 'Internet Explorer') browserVersion = extractRe('rv:(.*?)\\)? ', ua, 1) || browserVersion;

    var oses = [
      ['Windows (.*?)[;\)]', 'Windows'],
      ['Android ([0-9_\.]+)', 'Android'],
      ['iPhone OS ([0-9_\.]+)', 'iPhoneOS'],
      ['iPad.*? OS ([0-9_\.]+)', 'iPadOS'],
      ['FreeBSD( )', 'FreeBSD'],
      ['OpenBSD( )', 'OpenBSD'],
      ['Linux|X11()', 'Linux'],
      ['Mac OS X ([0-9_\.]+)', 'macOS'],
      ['bot|google|baidu|bing|msn|teoma|slurp|yandex', 'Search Bot']
    ];
    for(var o = 0; o < oses.length; ++o) {
      osVersion = extractRe(oses[o][0], ua, 1);
      if (osVersion) {
        os = oses[o][1];
        osVersion = osVersion.replace(/_/g, '.');
        break;
      }
    }
    var versionMappings = {
      'NT 5.0': '2000',
      'NT 5.1': 'XP',
      'NT 5.2': 'Server 2003',
      'NT 6.0': 'Vista',
      'NT 6.1': '7',
      'NT 6.2': '8',
      'NT 6.3': '8.1',
      'NT 10.0': '10'
    };
    osVersion = versionMappings[osVersion] || osVersion;

    // TODO: Add mobile device identifier, e.g. SM-G960U

    canvas = document.createElement("canvas");
    if (canvas) {
      gl = canvas.getContext("webgl2");
      glVersion = gl ? 2 : 0;
      if (!gl) {
        if (gl = canvas && canvas.getContext("webgl")) glVersion = 1;
      }

      if (gl) {
        gpu = (gl.getExtension("WEBGL_debug_renderer_info") && gl.getParameter(0x9246 /*debugRendererInfo.UNMASKED_RENDERER_WEBGL*/)) || gl.getParameter(0x1F01 /*gl.RENDERER*/);
      }
    }

    var hasThreads = typeof SharedArrayBuffer !== 'undefined';
    var hasWasm = typeof WebAssembly === "object" && typeof WebAssembly.compile === "function";
    return {
      width: screen.width,
      height: screen.height,
      userAgent: ua.trim(),
      browser: browser,
      browserVersion: browserVersion,
      mobile: /Mobile|Android|iP(ad|hone)/.test(navigator.appVersion),
      os: os,
      osVersion: osVersion,
      gpu: gpu,
      language: navigator.userLanguage || navigator.language,
      hasWebGL: glVersion,
      hasCursorLock: !!document.body.requestPointerLock,
      hasFullscreen: !!document.body.requestFullscreen,
      hasThreads: hasThreads,
      hasWasm: hasWasm,
      hasWasmThreads: (function() {
        var wasmMemory = hasWasm && hasThreads && new WebAssembly.Memory({"initial": 1, "maximum": 1, "shared": true});
        return wasmMemory && wasmMemory.buffer instanceof SharedArrayBuffer;
      })(),
    };
  })();

  function errorHandler(message, filename, lineno) {
    if (Module.startupErrorHandler) {
      Module.startupErrorHandler(message, filename, lineno);
      return;
    }
    if (Module.errorHandler && Module.errorHandler(message, filename, lineno))
      return;
    console.log("Invoking error handler due to\n" + message);
    if (typeof dump == "function")
      dump("Invoking error handler due to\n" + message);
    // Firefox has a bug where it's IndexedDB implementation will throw UnknownErrors, which are harmless, and should not be shown.
    if (message.indexOf("UnknownError") != -1)
      return;
    // Ignore error when application terminated with return code 0
    if (message.indexOf("Program terminated with exit(0)") != -1)
      return;
    if (errorHandler.didShowErrorMessage)
      return;
    var message = "An error occurred running the Unity content on this page. See your browser JavaScript console for more info. The error was:\n" + message;
    if (message.indexOf("DISABLE_EXCEPTION_CATCHING") != -1) {
      message = "An exception has occurred, but exception handling has been disabled in this build. If you are the developer of this content, enable exceptions in your project WebGL player settings to be able to catch the exception or see the stack trace.";
    } else if (message.indexOf("Cannot enlarge memory arrays") != -1) {
      message = "Out of memory. If you are the developer of this content, try allocating more memory to your WebGL build in the WebGL player settings.";
    } else if (message.indexOf("Invalid array buffer length") != -1  || message.indexOf("Invalid typed array length") != -1 || message.indexOf("out of memory") != -1 || message.indexOf("could not allocate memory") != -1) {
      message = "The browser could not allocate enough memory for the WebGL content. If you are the developer of this content, try allocating less memory to your WebGL build in the WebGL player settings.";
    }
    alert(message);
    errorHandler.didShowErrorMessage = true;
  }


  Module.abortHandler = function (message) {
    errorHandler(message, "", 0);
    return true;
  };

  Error.stackTraceLimit = Math.max(Error.stackTraceLimit || 0, 50);

  function progressUpdate(id, e) {
    if (id == "symbolsUrl")
      return;
    var progress = Module.downloadProgress[id];
    if (!progress)
      progress = Module.downloadProgress[id] = {
        started: false,
        finished: false,
        lengthComputable: false,
        total: 0,
        loaded: 0,
      };
    if (typeof e == "object" && (e.type == "progress" || e.type == "load")) {
      if (!progress.started) {
        progress.started = true;
        progress.lengthComputable = e.lengthComputable;
        progress.total = e.total;
      }
      progress.loaded = e.loaded;
      if (e.type == "load")
        progress.finished = true;
    }
    var loaded = 0, total = 0, started = 0, computable = 0, unfinishedNonComputable = 0;
    for (var id in Module.downloadProgress) {
      var progress = Module.downloadProgress[id];
      if (!progress.started)
        return 0;
      started++;
      if (progress.lengthComputable) {
        loaded += progress.loaded;
        total += progress.total;
        computable++;
      } else if (!progress.finished) {
        unfinishedNonComputable++;
      }
    }
    var totalProgress = started ? (started - unfinishedNonComputable - (total ? computable * (total - loaded) / total : 0)) / started : 0;
    onProgress(0.9 * totalProgress);
  }


  var decompressors = {
    gzip: {
      require: function require(e){var t,i={"inflate.js":function(e,t,i){"use strict";var u=e("./zlib/inflate"),h=e("./utils/common"),c=e("./utils/strings"),b=e("./zlib/constants"),n=e("./zlib/messages"),a=e("./zlib/zstream"),r=e("./zlib/gzheader"),m=Object.prototype.toString;function s(e){if(!(this instanceof s))return new s(e);this.options=h.assign({chunkSize:16384,windowBits:0,to:""},e||{});var t=this.options,e=(t.raw&&0<=t.windowBits&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(0<=t.windowBits&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),15<t.windowBits&&t.windowBits<48&&0==(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new a,this.strm.avail_out=0,u.inflateInit2(this.strm,t.windowBits));if(e!==b.Z_OK)throw new Error(n[e]);this.header=new r,u.inflateGetHeader(this.strm,this.header)}function o(e,t){t=new s(t);if(t.push(e,!0),t.err)throw t.msg||n[t.err];return t.result}s.prototype.push=function(e,t){var i,n,a,r,s,o=this.strm,f=this.options.chunkSize,l=this.options.dictionary,d=!1;if(this.ended)return!1;n=t===~~t?t:!0===t?b.Z_FINISH:b.Z_NO_FLUSH,"string"==typeof e?o.input=c.binstring2buf(e):"[object ArrayBuffer]"===m.call(e)?o.input=new Uint8Array(e):o.input=e,o.next_in=0,o.avail_in=o.input.length;do{if(0===o.avail_out&&(o.output=new h.Buf8(f),o.next_out=0,o.avail_out=f),(i=u.inflate(o,b.Z_NO_FLUSH))===b.Z_NEED_DICT&&l&&(s="string"==typeof l?c.string2buf(l):"[object ArrayBuffer]"===m.call(l)?new Uint8Array(l):l,i=u.inflateSetDictionary(this.strm,s)),i===b.Z_BUF_ERROR&&!0===d&&(i=b.Z_OK,d=!1),i!==b.Z_STREAM_END&&i!==b.Z_OK)return this.onEnd(i),!(this.ended=!0)}while(!o.next_out||0!==o.avail_out&&i!==b.Z_STREAM_END&&(0!==o.avail_in||n!==b.Z_FINISH&&n!==b.Z_SYNC_FLUSH)||("string"===this.options.to?(s=c.utf8border(o.output,o.next_out),a=o.next_out-s,r=c.buf2string(o.output,s),o.next_out=a,o.avail_out=f-a,a&&h.arraySet(o.output,o.output,s,a,0),this.onData(r)):this.onData(h.shrinkBuf(o.output,o.next_out))),0===o.avail_in&&0===o.avail_out&&(d=!0),(0<o.avail_in||0===o.avail_out)&&i!==b.Z_STREAM_END);return(n=i===b.Z_STREAM_END?b.Z_FINISH:n)===b.Z_FINISH?(i=u.inflateEnd(this.strm),this.onEnd(i),this.ended=!0,i===b.Z_OK):n!==b.Z_SYNC_FLUSH||(this.onEnd(b.Z_OK),!(o.avail_out=0))},s.prototype.onData=function(e){this.chunks.push(e)},s.prototype.onEnd=function(e){e===b.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=h.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},i.Inflate=s,i.inflate=o,i.inflateRaw=function(e,t){return(t=t||{}).raw=!0,o(e,t)},i.ungzip=o},"utils/common.js":function(e,t,i){"use strict";var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array,a=(i.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var i=t.shift();if(i){if("object"!=typeof i)throw new TypeError(i+"must be non-object");for(var n in i)i.hasOwnProperty(n)&&(e[n]=i[n])}}return e},i.shrinkBuf=function(e,t){if(e.length!==t){if(e.subarray)return e.subarray(0,t);e.length=t}return e},{arraySet:function(e,t,i,n,a){if(t.subarray&&e.subarray)e.set(t.subarray(i,i+n),a);else for(var r=0;r<n;r++)e[a+r]=t[i+r]},flattenChunks:function(e){for(var t,i,n,a=0,r=0,s=e.length;r<s;r++)a+=e[r].length;for(n=new Uint8Array(a),r=t=0,s=e.length;r<s;r++)i=e[r],n.set(i,t),t+=i.length;return n}}),r={arraySet:function(e,t,i,n,a){for(var r=0;r<n;r++)e[a+r]=t[i+r]},flattenChunks:function(e){return[].concat.apply([],e)}};i.setTyped=function(e){e?(i.Buf8=Uint8Array,i.Buf16=Uint16Array,i.Buf32=Int32Array,i.assign(i,a)):(i.Buf8=Array,i.Buf16=Array,i.Buf32=Array,i.assign(i,r))},i.setTyped(n)},"utils/strings.js":function(e,t,i){"use strict";var f=e("./common"),a=!0,r=!0;try{String.fromCharCode.apply(null,[0])}catch(e){a=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(e){r=!1}for(var l=new f.Buf8(256),n=0;n<256;n++)l[n]=252<=n?6:248<=n?5:240<=n?4:224<=n?3:192<=n?2:1;function d(e,t){if(t<65537&&(e.subarray&&r||!e.subarray&&a))return String.fromCharCode.apply(null,f.shrinkBuf(e,t));for(var i="",n=0;n<t;n++)i+=String.fromCharCode(e[n]);return i}l[254]=l[254]=1,i.string2buf=function(e){for(var t,i,n,a,r=e.length,s=0,o=0;o<r;o++)55296==(64512&(i=e.charCodeAt(o)))&&o+1<r&&56320==(64512&(n=e.charCodeAt(o+1)))&&(i=65536+(i-55296<<10)+(n-56320),o++),s+=i<128?1:i<2048?2:i<65536?3:4;for(t=new f.Buf8(s),o=a=0;a<s;o++)55296==(64512&(i=e.charCodeAt(o)))&&o+1<r&&56320==(64512&(n=e.charCodeAt(o+1)))&&(i=65536+(i-55296<<10)+(n-56320),o++),i<128?t[a++]=i:(i<2048?t[a++]=192|i>>>6:(i<65536?t[a++]=224|i>>>12:(t[a++]=240|i>>>18,t[a++]=128|i>>>12&63),t[a++]=128|i>>>6&63),t[a++]=128|63&i);return t},i.buf2binstring=function(e){return d(e,e.length)},i.binstring2buf=function(e){for(var t=new f.Buf8(e.length),i=0,n=t.length;i<n;i++)t[i]=e.charCodeAt(i);return t},i.buf2string=function(e,t){for(var i,n,a=t||e.length,r=new Array(2*a),s=0,o=0;o<a;)if((i=e[o++])<128)r[s++]=i;else if(4<(n=l[i]))r[s++]=65533,o+=n-1;else{for(i&=2===n?31:3===n?15:7;1<n&&o<a;)i=i<<6|63&e[o++],n--;1<n?r[s++]=65533:i<65536?r[s++]=i:(i-=65536,r[s++]=55296|i>>10&1023,r[s++]=56320|1023&i)}return d(r,s)},i.utf8border=function(e,t){for(var i=(t=(t=t||e.length)>e.length?e.length:t)-1;0<=i&&128==(192&e[i]);)i--;return!(i<0)&&0!==i&&i+l[e[i]]>t?i:t}},"zlib/inflate.js":function(e,i,t){"use strict";var N=e("../utils/common"),C=e("./adler32"),O=e("./crc32"),ue=e("./inffast"),I=e("./inftrees"),he=0,T=1,F=2,U=4,ce=5,j=6,D=0,be=1,me=2,L=-2,H=-3,K=-4,we=-5,M=8,P=1,Y=2,G=3,X=4,q=5,W=6,J=7,Q=8,V=9,$=10,ee=11,te=12,ie=13,ke=14,ne=15,_e=16,ge=17,ve=18,pe=19,ae=20,re=21,xe=22,ye=23,Se=24,Be=25,Ee=26,se=27,Ze=28,Ae=29,oe=30,fe=31,n=852,a=592,r=15;function ze(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function s(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new N.Buf16(320),this.work=new N.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function o(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=P,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new N.Buf32(n),t.distcode=t.distdyn=new N.Buf32(a),t.sane=1,t.back=-1,D):L}function f(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,o(e)):L}function l(e,t){var i,n;return!e||!e.state||(n=e.state,t<0?(i=0,t=-t):(i=1+(t>>4),t<48&&(t&=15)),t&&(t<8||15<t))?L:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=i,n.wbits=t,f(e))}function d(e,t){var i;return e?(i=new s,(e.state=i).window=null,(i=l(e,t))!==D&&(e.state=null),i):L}var le,de,Re=!0;function Ne(e,t,i,n){var a,e=e.state;return null===e.window&&(e.wsize=1<<e.wbits,e.wnext=0,e.whave=0,e.window=new N.Buf8(e.wsize)),n>=e.wsize?(N.arraySet(e.window,t,i-e.wsize,e.wsize,0),e.wnext=0,e.whave=e.wsize):(n<(a=e.wsize-e.wnext)&&(a=n),N.arraySet(e.window,t,i-n,a,e.wnext),(n-=a)?(N.arraySet(e.window,t,i-n,n,0),e.wnext=n,e.whave=e.wsize):(e.wnext+=a,e.wnext===e.wsize&&(e.wnext=0),e.whave<e.wsize&&(e.whave+=a))),0}t.inflateReset=f,t.inflateReset2=l,t.inflateResetKeep=o,t.inflateInit=function(e){return d(e,r)},t.inflateInit2=d,t.inflate=function(e,t){var i,n,a,r,s,o,f,l,d,u,h,c,b,m,w,k,_,g,v,p,x,y,S,B,E=0,Z=new N.Buf8(4),A=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return L;(i=e.state).mode===te&&(i.mode=ie),s=e.next_out,a=e.output,f=e.avail_out,r=e.next_in,n=e.input,o=e.avail_in,l=i.hold,d=i.bits,u=o,h=f,y=D;e:for(;;)switch(i.mode){case P:if(0===i.wrap)i.mode=ie;else{for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(2&i.wrap&&35615===l)Z[i.check=0]=255&l,Z[1]=l>>>8&255,i.check=O(i.check,Z,2,0),d=l=0,i.mode=Y;else if(i.flags=0,i.head&&(i.head.done=!1),!(1&i.wrap)||(((255&l)<<8)+(l>>8))%31)e.msg="incorrect header check",i.mode=oe;else if((15&l)!==M)e.msg="unknown compression method",i.mode=oe;else{if(d-=4,x=8+(15&(l>>>=4)),0===i.wbits)i.wbits=x;else if(x>i.wbits){e.msg="invalid window size",i.mode=oe;break}i.dmax=1<<x,e.adler=i.check=1,i.mode=512&l?$:te,d=l=0}}break;case Y:for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(i.flags=l,(255&i.flags)!==M){e.msg="unknown compression method",i.mode=oe;break}if(57344&i.flags){e.msg="unknown header flags set",i.mode=oe;break}i.head&&(i.head.text=l>>8&1),512&i.flags&&(Z[0]=255&l,Z[1]=l>>>8&255,i.check=O(i.check,Z,2,0)),d=l=0,i.mode=G;case G:for(;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}i.head&&(i.head.time=l),512&i.flags&&(Z[0]=255&l,Z[1]=l>>>8&255,Z[2]=l>>>16&255,Z[3]=l>>>24&255,i.check=O(i.check,Z,4,0)),d=l=0,i.mode=X;case X:for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}i.head&&(i.head.xflags=255&l,i.head.os=l>>8),512&i.flags&&(Z[0]=255&l,Z[1]=l>>>8&255,i.check=O(i.check,Z,2,0)),d=l=0,i.mode=q;case q:if(1024&i.flags){for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}i.length=l,i.head&&(i.head.extra_len=l),512&i.flags&&(Z[0]=255&l,Z[1]=l>>>8&255,i.check=O(i.check,Z,2,0)),d=l=0}else i.head&&(i.head.extra=null);i.mode=W;case W:if(1024&i.flags&&((c=o<(c=i.length)?o:c)&&(i.head&&(x=i.head.extra_len-i.length,i.head.extra||(i.head.extra=new Array(i.head.extra_len)),N.arraySet(i.head.extra,n,r,c,x)),512&i.flags&&(i.check=O(i.check,n,c,r)),o-=c,r+=c,i.length-=c),i.length))break e;i.length=0,i.mode=J;case J:if(2048&i.flags){if(0===o)break e;for(c=0;x=n[r+c++],i.head&&x&&i.length<65536&&(i.head.name+=String.fromCharCode(x)),x&&c<o;);if(512&i.flags&&(i.check=O(i.check,n,c,r)),o-=c,r+=c,x)break e}else i.head&&(i.head.name=null);i.length=0,i.mode=Q;case Q:if(4096&i.flags){if(0===o)break e;for(c=0;x=n[r+c++],i.head&&x&&i.length<65536&&(i.head.comment+=String.fromCharCode(x)),x&&c<o;);if(512&i.flags&&(i.check=O(i.check,n,c,r)),o-=c,r+=c,x)break e}else i.head&&(i.head.comment=null);i.mode=V;case V:if(512&i.flags){for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(l!==(65535&i.check)){e.msg="header crc mismatch",i.mode=oe;break}d=l=0}i.head&&(i.head.hcrc=i.flags>>9&1,i.head.done=!0),e.adler=i.check=0,i.mode=te;break;case $:for(;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}e.adler=i.check=ze(l),d=l=0,i.mode=ee;case ee:if(0===i.havedict)return e.next_out=s,e.avail_out=f,e.next_in=r,e.avail_in=o,i.hold=l,i.bits=d,me;e.adler=i.check=1,i.mode=te;case te:if(t===ce||t===j)break e;case ie:if(i.last)l>>>=7&d,d-=7&d,i.mode=se;else{for(;d<3;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}switch(i.last=1&l,--d,3&(l>>>=1)){case 0:i.mode=ke;break;case 1:z=R=void 0;var z,R=i;if(Re){for(le=new N.Buf32(512),de=new N.Buf32(32),z=0;z<144;)R.lens[z++]=8;for(;z<256;)R.lens[z++]=9;for(;z<280;)R.lens[z++]=7;for(;z<288;)R.lens[z++]=8;for(I(T,R.lens,0,288,le,0,R.work,{bits:9}),z=0;z<32;)R.lens[z++]=5;I(F,R.lens,0,32,de,0,R.work,{bits:5}),Re=!1}if(R.lencode=le,R.lenbits=9,R.distcode=de,R.distbits=5,i.mode=ae,t!==j)break;l>>>=2,d-=2;break e;case 2:i.mode=ge;break;case 3:e.msg="invalid block type",i.mode=oe}l>>>=2,d-=2}break;case ke:for(l>>>=7&d,d-=7&d;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if((65535&l)!=(l>>>16^65535)){e.msg="invalid stored block lengths",i.mode=oe;break}if(i.length=65535&l,d=l=0,i.mode=ne,t===j)break e;case ne:i.mode=_e;case _e:if(c=i.length){if(0===(c=f<(c=o<c?o:c)?f:c))break e;N.arraySet(a,n,r,c,s),o-=c,r+=c,f-=c,s+=c,i.length-=c}else i.mode=te;break;case ge:for(;d<14;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(i.nlen=257+(31&l),l>>>=5,d-=5,i.ndist=1+(31&l),l>>>=5,d-=5,i.ncode=4+(15&l),l>>>=4,d-=4,286<i.nlen||30<i.ndist){e.msg="too many length or distance symbols",i.mode=oe;break}i.have=0,i.mode=ve;case ve:for(;i.have<i.ncode;){for(;d<3;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}i.lens[A[i.have++]]=7&l,l>>>=3,d-=3}for(;i.have<19;)i.lens[A[i.have++]]=0;if(i.lencode=i.lendyn,i.lenbits=7,S={bits:i.lenbits},y=I(he,i.lens,0,19,i.lencode,0,i.work,S),i.lenbits=S.bits,y){e.msg="invalid code lengths set",i.mode=oe;break}i.have=0,i.mode=pe;case pe:for(;i.have<i.nlen+i.ndist;){for(;k=(E=i.lencode[l&(1<<i.lenbits)-1])>>>16&255,_=65535&E,!((w=E>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(_<16)l>>>=w,d-=w,i.lens[i.have++]=_;else{if(16===_){for(B=w+2;d<B;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(l>>>=w,d-=w,0===i.have){e.msg="invalid bit length repeat",i.mode=oe;break}x=i.lens[i.have-1],c=3+(3&l),l>>>=2,d-=2}else if(17===_){for(B=w+3;d<B;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}x=0,c=3+(7&(l>>>=w)),l>>>=3,d=d-w-3}else{for(B=w+7;d<B;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}x=0,c=11+(127&(l>>>=w)),l>>>=7,d=d-w-7}if(i.have+c>i.nlen+i.ndist){e.msg="invalid bit length repeat",i.mode=oe;break}for(;c--;)i.lens[i.have++]=x}}if(i.mode===oe)break;if(0===i.lens[256]){e.msg="invalid code -- missing end-of-block",i.mode=oe;break}if(i.lenbits=9,S={bits:i.lenbits},y=I(T,i.lens,0,i.nlen,i.lencode,0,i.work,S),i.lenbits=S.bits,y){e.msg="invalid literal/lengths set",i.mode=oe;break}if(i.distbits=6,i.distcode=i.distdyn,S={bits:i.distbits},y=I(F,i.lens,i.nlen,i.ndist,i.distcode,0,i.work,S),i.distbits=S.bits,y){e.msg="invalid distances set",i.mode=oe;break}if(i.mode=ae,t===j)break e;case ae:i.mode=re;case re:if(6<=o&&258<=f){e.next_out=s,e.avail_out=f,e.next_in=r,e.avail_in=o,i.hold=l,i.bits=d,ue(e,h),s=e.next_out,a=e.output,f=e.avail_out,r=e.next_in,n=e.input,o=e.avail_in,l=i.hold,d=i.bits,i.mode===te&&(i.back=-1);break}for(i.back=0;k=(E=i.lencode[l&(1<<i.lenbits)-1])>>>16&255,_=65535&E,!((w=E>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(k&&0==(240&k)){for(g=w,v=k,p=_;k=(E=i.lencode[p+((l&(1<<g+v)-1)>>g)])>>>16&255,_=65535&E,!(g+(w=E>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}l>>>=g,d-=g,i.back+=g}if(l>>>=w,d-=w,i.back+=w,i.length=_,0===k){i.mode=Ee;break}if(32&k){i.back=-1,i.mode=te;break}if(64&k){e.msg="invalid literal/length code",i.mode=oe;break}i.extra=15&k,i.mode=xe;case xe:if(i.extra){for(B=i.extra;d<B;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}i.length+=l&(1<<i.extra)-1,l>>>=i.extra,d-=i.extra,i.back+=i.extra}i.was=i.length,i.mode=ye;case ye:for(;k=(E=i.distcode[l&(1<<i.distbits)-1])>>>16&255,_=65535&E,!((w=E>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(0==(240&k)){for(g=w,v=k,p=_;k=(E=i.distcode[p+((l&(1<<g+v)-1)>>g)])>>>16&255,_=65535&E,!(g+(w=E>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}l>>>=g,d-=g,i.back+=g}if(l>>>=w,d-=w,i.back+=w,64&k){e.msg="invalid distance code",i.mode=oe;break}i.offset=_,i.extra=15&k,i.mode=Se;case Se:if(i.extra){for(B=i.extra;d<B;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}i.offset+=l&(1<<i.extra)-1,l>>>=i.extra,d-=i.extra,i.back+=i.extra}if(i.offset>i.dmax){e.msg="invalid distance too far back",i.mode=oe;break}i.mode=Be;case Be:if(0===f)break e;if(i.offset>(c=h-f)){if((c=i.offset-c)>i.whave&&i.sane){e.msg="invalid distance too far back",i.mode=oe;break}b=c>i.wnext?(c-=i.wnext,i.wsize-c):i.wnext-c,c>i.length&&(c=i.length),m=i.window}else m=a,b=s-i.offset,c=i.length;for(f-=c=f<c?f:c,i.length-=c;a[s++]=m[b++],--c;);0===i.length&&(i.mode=re);break;case Ee:if(0===f)break e;a[s++]=i.length,f--,i.mode=re;break;case se:if(i.wrap){for(;d<32;){if(0===o)break e;o--,l|=n[r++]<<d,d+=8}if(h-=f,e.total_out+=h,i.total+=h,h&&(e.adler=i.check=(i.flags?O:C)(i.check,a,h,s-h)),h=f,(i.flags?l:ze(l))!==i.check){e.msg="incorrect data check",i.mode=oe;break}d=l=0}i.mode=Ze;case Ze:if(i.wrap&&i.flags){for(;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(l!==(4294967295&i.total)){e.msg="incorrect length check",i.mode=oe;break}d=l=0}i.mode=Ae;case Ae:y=be;break e;case oe:y=H;break e;case fe:return K;default:return L}return e.next_out=s,e.avail_out=f,e.next_in=r,e.avail_in=o,i.hold=l,i.bits=d,(i.wsize||h!==e.avail_out&&i.mode<oe&&(i.mode<se||t!==U))&&Ne(e,e.output,e.next_out,h-e.avail_out)?(i.mode=fe,K):(u-=e.avail_in,h-=e.avail_out,e.total_in+=u,e.total_out+=h,i.total+=h,i.wrap&&h&&(e.adler=i.check=(i.flags?O:C)(i.check,a,h,e.next_out-h)),e.data_type=i.bits+(i.last?64:0)+(i.mode===te?128:0)+(i.mode===ae||i.mode===ne?256:0),(0==u&&0===h||t===U)&&y===D?we:y)},t.inflateEnd=function(e){var t;return e&&e.state?((t=e.state).window&&(t.window=null),e.state=null,D):L},t.inflateGetHeader=function(e,t){return!e||!e.state||0==(2&(e=e.state).wrap)?L:((e.head=t).done=!1,D)},t.inflateSetDictionary=function(e,t){var i,n=t.length;return!e||!e.state||0!==(i=e.state).wrap&&i.mode!==ee?L:i.mode===ee&&C(1,t,n,0)!==i.check?H:Ne(e,t,n,n)?(i.mode=fe,K):(i.havedict=1,D)},t.inflateInfo="pako inflate (from Nodeca project)"},"zlib/constants.js":function(e,t,i){"use strict";t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},"zlib/messages.js":function(e,t,i){"use strict";t.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},"zlib/zstream.js":function(e,t,i){"use strict";t.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}},"zlib/gzheader.js":function(e,t,i){"use strict";t.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}},"zlib/adler32.js":function(e,t,i){"use strict";t.exports=function(e,t,i,n){for(var a=65535&e|0,r=e>>>16&65535|0,s=0;0!==i;){for(i-=s=2e3<i?2e3:i;r=r+(a=a+t[n++]|0)|0,--s;);a%=65521,r%=65521}return a|r<<16|0}},"zlib/crc32.js":function(e,t,i){"use strict";var o=function(){for(var e=[],t=0;t<256;t++){for(var i=t,n=0;n<8;n++)i=1&i?3988292384^i>>>1:i>>>1;e[t]=i}return e}();t.exports=function(e,t,i,n){var a=o,r=n+i;e^=-1;for(var s=n;s<r;s++)e=e>>>8^a[255&(e^t[s])];return-1^e}},"zlib/inffast.js":function(e,t,i){"use strict";t.exports=function(e,t){var i,n,a,r,s,o,f=e.state,l=e.next_in,d=e.input,u=l+(e.avail_in-5),h=e.next_out,c=e.output,b=h-(t-e.avail_out),m=h+(e.avail_out-257),w=f.dmax,k=f.wsize,_=f.whave,g=f.wnext,v=f.window,p=f.hold,x=f.bits,y=f.lencode,S=f.distcode,B=(1<<f.lenbits)-1,E=(1<<f.distbits)-1;e:do{for(x<15&&(p+=d[l++]<<x,x+=8,p+=d[l++]<<x,x+=8),i=y[p&B];;){if(p>>>=n=i>>>24,x-=n,0===(n=i>>>16&255))c[h++]=65535&i;else{if(!(16&n)){if(0==(64&n)){i=y[(65535&i)+(p&(1<<n)-1)];continue}if(32&n){f.mode=12;break e}e.msg="invalid literal/length code",f.mode=30;break e}for(a=65535&i,(n&=15)&&(x<n&&(p+=d[l++]<<x,x+=8),a+=p&(1<<n)-1,p>>>=n,x-=n),x<15&&(p+=d[l++]<<x,x+=8,p+=d[l++]<<x,x+=8),i=S[p&E];;){if(p>>>=n=i>>>24,x-=n,!(16&(n=i>>>16&255))){if(0==(64&n)){i=S[(65535&i)+(p&(1<<n)-1)];continue}e.msg="invalid distance code",f.mode=30;break e}if(r=65535&i,x<(n&=15)&&(p+=d[l++]<<x,(x+=8)<n&&(p+=d[l++]<<x,x+=8)),w<(r+=p&(1<<n)-1)){e.msg="invalid distance too far back",f.mode=30;break e}if(p>>>=n,x-=n,(n=h-b)<r){if(_<(n=r-n)&&f.sane){e.msg="invalid distance too far back",f.mode=30;break e}if(o=v,(s=0)===g){if(s+=k-n,n<a){for(a-=n;c[h++]=v[s++],--n;);s=h-r,o=c}}else if(g<n){if(s+=k+g-n,(n-=g)<a){for(a-=n;c[h++]=v[s++],--n;);if(s=0,g<a){for(a-=n=g;c[h++]=v[s++],--n;);s=h-r,o=c}}}else if(s+=g-n,n<a){for(a-=n;c[h++]=v[s++],--n;);s=h-r,o=c}for(;2<a;)c[h++]=o[s++],c[h++]=o[s++],c[h++]=o[s++],a-=3;a&&(c[h++]=o[s++],1<a&&(c[h++]=o[s++]))}else{for(s=h-r;c[h++]=c[s++],c[h++]=c[s++],c[h++]=c[s++],2<(a-=3););a&&(c[h++]=c[s++],1<a&&(c[h++]=c[s++]))}break}}break}}while(l<u&&h<m);p&=(1<<(x-=(a=x>>3)<<3))-1,e.next_in=l-=a,e.next_out=h,e.avail_in=l<u?u-l+5:5-(l-u),e.avail_out=h<m?m-h+257:257-(h-m),f.hold=p,f.bits=x}},"zlib/inftrees.js":function(e,t,i){"use strict";var I=e("../utils/common"),T=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],F=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],U=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],j=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,i,n,a,r,s,o){for(var f,l,d,u,h,c,b,m,w,k=o.bits,_=0,g=0,v=0,p=0,x=0,y=0,S=0,B=0,E=0,Z=0,A=null,z=0,R=new I.Buf16(16),N=new I.Buf16(16),C=null,O=0,_=0;_<=15;_++)R[_]=0;for(g=0;g<n;g++)R[t[i+g]]++;for(x=k,p=15;1<=p&&0===R[p];p--);if(p<x&&(x=p),0===p)a[r++]=20971520,a[r++]=20971520,o.bits=1;else{for(v=1;v<p&&0===R[v];v++);for(x<v&&(x=v),_=B=1;_<=15;_++)if((B=(B<<=1)-R[_])<0)return-1;if(0<B&&(0===e||1!==p))return-1;for(N[1]=0,_=1;_<15;_++)N[_+1]=N[_]+R[_];for(g=0;g<n;g++)0!==t[i+g]&&(s[N[t[i+g]]++]=g);if(c=0===e?(A=C=s,19):1===e?(A=T,z-=257,C=F,O-=257,256):(A=U,C=j,-1),_=v,h=r,S=g=Z=0,d=-1,u=(E=1<<(y=x))-1,1===e&&852<E||2===e&&592<E)return 1;for(;;){for(w=s[g]<c?(m=0,s[g]):s[g]>c?(m=C[O+s[g]],A[z+s[g]]):(m=96,0),f=1<<(b=_-S),v=l=1<<y;a[h+(Z>>S)+(l-=f)]=b<<24|m<<16|w|0,0!==l;);for(f=1<<_-1;Z&f;)f>>=1;if(Z=0!==f?(Z&f-1)+f:0,g++,0==--R[_]){if(_===p)break;_=t[i+s[g]]}if(x<_&&(Z&u)!==d){for(h+=v,B=1<<(y=_-(S=0===S?x:S));y+S<p&&!((B-=R[y+S])<=0);)y++,B<<=1;if(E+=1<<y,1===e&&852<E||2===e&&592<E)return 1;a[d=Z&u]=x<<24|y<<16|h-r|0}}0!==Z&&(a[h+Z]=_-S<<24|64<<16|0),o.bits=x}return 0}}};for(t in i)i[t].folder=t.substring(0,t.lastIndexOf("/")+1);function n(e,t){var i=t.match(/^\//)?null:e?t.match(/^\.\.?\//)?a(e.folder+t):r(e,t):a(t);if(i)return i.exports||(i.parent=e,i(n.bind(null,i),i,i.exports={})),i.exports;throw"module not found: "+t}var a=function(e){var t=[];return(e=e.split("/").every(function(e){return".."==e?t.pop():"."==e||""==e||t.push(e)})?t.join("/"):null)?i[e]||i[e+".js"]||i[e+"/index.js"]:null},r=function(e,t){return e?a(e.folder+"node_modules/"+t)||r(e.parent,t):null};return n(null,e)},
      decompress: function (data) {
        if (!this.exports)
          this.exports = this.require("inflate.js");
        try { return this.exports.inflate(data) } catch (e) {};
      },
      hasUnityMarker: function (data) {
        var commentOffset = 10, expectedComment = "UnityWeb Compressed Content (gzip)";
        if (commentOffset > data.length || data[0] != 0x1F || data[1] != 0x8B)
          return false;
        var flags = data[3];
        if (flags & 0x04) {
          if (commentOffset + 2 > data.length)
            return false;
          commentOffset += 2 + data[commentOffset] + (data[commentOffset + 1] << 8);
          if (commentOffset > data.length)
            return false;
        }
        if (flags & 0x08) {
          while (commentOffset < data.length && data[commentOffset])
            commentOffset++;
          if (commentOffset + 1 > data.length)
            return false;
          commentOffset++;
        }
        return (flags & 0x10) && String.fromCharCode.apply(null, data.subarray(commentOffset, commentOffset + expectedComment.length + 1)) == expectedComment + "\0";
      },
    },
  };

  function decompress(compressed, url, callback) {
    for (var contentEncoding in decompressors) {
      if (decompressors[contentEncoding].hasUnityMarker(compressed)) {
        if (url)
          console.log("You can reduce startup time if you configure your web server to add \"Content-Encoding: " + contentEncoding + "\" response header when serving \"" + url + "\" file.");
        var decompressor = decompressors[contentEncoding];
        if (!decompressor.worker) {
          var workerUrl = URL.createObjectURL(new Blob(["this.require = ", decompressor.require.toString(), "; this.decompress = ", decompressor.decompress.toString(), "; this.onmessage = ", function (e) {
            var data = { id: e.data.id, decompressed: this.decompress(e.data.compressed) };
            postMessage(data, data.decompressed ? [data.decompressed.buffer] : []);
          }.toString(), "; postMessage({ ready: true });"], { type: "application/javascript" }));
          decompressor.worker = new Worker(workerUrl);
          decompressor.worker.onmessage = function (e) {
            if (e.data.ready) {
              URL.revokeObjectURL(workerUrl);
              return;
            }
            this.callbacks[e.data.id](e.data.decompressed);
            delete this.callbacks[e.data.id];
          };
          decompressor.worker.callbacks = {};
          decompressor.worker.nextCallbackId = 0;
        }
        var id = decompressor.worker.nextCallbackId++;
        decompressor.worker.callbacks[id] = callback;
        decompressor.worker.postMessage({id: id, compressed: compressed}, [compressed.buffer]);
        return;
      }
    }
    callback(compressed);
  }

  function downloadBinary(urlId) {
    return new Promise(function (resolve, reject) {
      progressUpdate(urlId);
      var xhr = new XMLHttpRequest();
      xhr.open("GET", Module[urlId]);
      xhr.responseType = "arraybuffer";
      xhr.addEventListener("progress", function (e) {
        progressUpdate(urlId, e);
      });
      xhr.addEventListener("load", function(e) {
        progressUpdate(urlId, e);
        decompress(new Uint8Array(xhr.response), Module[urlId], resolve);
      });
      xhr.send();
    });
  }

  function downloadFramework() {
    return downloadBinary("frameworkUrl").then(function (code) {
      var blobUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = blobUrl;
        script.onload = function () {
          // Adding the framework.js script to DOM created a global
          // 'unityFramework' variable that should be considered internal.
          // Capture the variable to local scope and clear it from global
          // scope so that JS garbage collection can take place on
          // application quit.
          var fw = unityFramework;
          unityFramework = null;
          // Also ensure this function will not hold any JS scope
          // references to prevent JS garbage collection.
          script.onload = null;
          URL.revokeObjectURL(blobUrl);
          resolve(fw);
        }
        document.body.appendChild(script);
        Module.deinitializers.push(function() {
          document.body.removeChild(script);
        });
      });
    });
  }

  function loadBuild() {
    Promise.all([
      downloadFramework(),
      downloadBinary("codeUrl"),
    ]).then(function (results) {
      Module.wasmBinary = results[1];
      results[0](Module);
    });

    var dataPromise = downloadBinary("dataUrl");
    Module.preRun.push(function () {
      Module.addRunDependency("dataUrl");
      dataPromise.then(function (data) {
        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var pos = 0;
        var prefix = "UnityWebData1.0\0";
        if (!String.fromCharCode.apply(null, data.subarray(pos, pos + prefix.length)) == prefix)
          throw "unknown data format";
        pos += prefix.length;
        var headerSize = view.getUint32(pos, true); pos += 4;
        while (pos < headerSize) {
          var offset = view.getUint32(pos, true); pos += 4;
          var size = view.getUint32(pos, true); pos += 4;
          var pathLength = view.getUint32(pos, true); pos += 4;
          var path = String.fromCharCode.apply(null, data.subarray(pos, pos + pathLength)); pos += pathLength;
          for (var folder = 0, folderNext = path.indexOf("/", folder) + 1 ; folderNext > 0; folder = folderNext, folderNext = path.indexOf("/", folder) + 1)
            Module.FS_createPath(path.substring(0, folder), path.substring(folder, folderNext - 1), true, true);
          Module.FS_createDataFile(path, null, data.subarray(offset, offset + size), true, true, true);
        }
        Module.removeRunDependency("dataUrl");
      });
    });
  }

  return new Promise(function (resolve, reject) {
    if (!Module.SystemInfo.hasWebGL) {
      reject("Your browser does not support WebGL.");
    } else if (!Module.SystemInfo.hasWasm) {
      reject("Your browser does not support WebAssembly.");
    } else {
      if (Module.SystemInfo.hasWebGL == 1)
        Module.print("Warning: Your browser does not support \"WebGL 2.0\" Graphics API, switching to \"WebGL 1.0\"");
      Module.startupErrorHandler = reject;
      onProgress(0);
      Module.postRun.push(function () {
        onProgress(1);
        delete Module.startupErrorHandler;
        resolve(unityInstance);
      });
      loadBuild();
    }
  });
}
