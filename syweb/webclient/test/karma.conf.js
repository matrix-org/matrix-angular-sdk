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
    // XXX: Order is important, and doing /js/angular* makes the tests not run :/
    files: [
      '../app/lib/jquery*',
      '../app/lib/angular.js',
      '../app/lib/angular-mocks.js',
      '../app/lib/angular-route.js',
      '../app/lib/angular-animate.js',
      '../app/lib/angular-sanitize.js',
      '../app/lib/jquery.peity.min.js',
      '../app/lib/angular-peity.js',
      '../app/lib/ng-infinite-scroll-matrix.js',
      '../app/lib/ui-bootstrap*',
      '../app/lib/elastic.js',  
      '../app/login/**/*.js',
      '../app/room/**/*.js',
      '../app/components/**/*.js',
      '../app/user/**/*.js',
      '../app/home/**/*.js',
      '../app/recents/**/*.js',
      '../app/settings/**/*.js',
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
      '../app/login/**/*.js': 'coverage', 
      '../app/room/**/*.js': 'coverage',
      '../app/components/**/*.js': 'coverage',
      '../app/user/**/*.js': 'coverage',
      '../app/home/**/*.js': 'coverage',
      '../app/recents/**/*.js': 'coverage',
      '../app/settings/**/*.js': 'coverage',
      '../app/app.js': 'coverage'
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
