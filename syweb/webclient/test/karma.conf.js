// Karma configuration
// Generated on Thu Sep 18 2014 14:25:57 GMT+0100 (BST)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    // XXX: Order is important; doing /js/angular* makes the tests not run,
    // hence angular.js THEN angular-*.js. Also, this is also why we import
    // everything but app*, then app.js, then app*.js else you get
    // "Module 'matrixWebClient' is not available!" errors.
    files: [
      '../lib/jquery*',
      '../lib/angular.js',
      '../lib/angular-*.js',
      '../lib/jquery.peity.min.js',
      '../lib/ng-infinite-scroll-matrix.js',
      '../lib/ui-bootstrap*',
      '../lib/elastic.js',  
      '../app/**/!(app*).js',
      '../app/app.js',
      '../app/app*',
      './unit/**/*.js'
    ],

    plugins: [
        'karma-*',
    ],


    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      '../app/**/*.js': 'coverage' 
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'junit', 'coverage'],
    junitReporter: {
        outputFile: 'test-results.xml',
        suite: ''
    },

    coverageReporter: {
        type: 'cobertura',
        dir: 'coverage/',
        file: 'coverage.xml'
    },

    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_DEBUG,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true
  });
};
