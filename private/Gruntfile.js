/*jslint node: true */
/*
 * grunt
 * http://gruntjs.com/
 *
 * Copyright (c) 2012 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * https://github.com/gruntjs/grunt/blob/master/LICENSE-MIT
 */

"use strict";

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options: {
        smarttabs: true
      },
      client: {
        options: {
          jquery: true,
          smarttabs: true
        },
        files: [{src: '../public/js/client.js'}],
      },
      server: {
        options: {
          node: true,
          smarttabs: true
        },
        files: [{src: '../server.js'}],
      },
    },

    jshint2: {
        gruntfile: {
          options: {
            jshintrc: '.jshintrc',
            smarttabs: true
          },
          src: 'Gruntfile.js'
        },
        individual_files: {
          files: [
            {src: 'Gruntfile.js'},
            {src: '../public/js/client.js'}
          ],
          options: {
            smarttabs: true
          }
        },
        scripts: {
          files: [
            { src: '../public/js/client.js' },
            { src: '../server.js' }
          ],
          options: {
            smarttabs: true
          }
        }
        
      },

      sass: {    
          compile: {                                      
              files: {
                  '../public/css/all.css': ['../public/css/sass/all.scss']
              },
              options: {
                noCache: true
              }
          }
      },

       watch: {
          css: {
              files: ['../public/css/sass/*.scss'],
              tasks: ['sass']
            },
          html: {
              files: ['../public/index.html'],
              tasks: ['htmllint:index']
          },
          jshint_client: {
              files: ['../public/js/client.js'],
              tasks: ['jshint:client']
          },
          jshint_server: {
              files: ['../server.js'],
              tasks: ['jshint:server']
          }
      },

      cssmin: {
          my_target: {
              src: '../public/css/all.css',
              dest: '../public/css/all.min.css'
          }
      },

      min: {
         'js': {
              'src': ['../public/js/client.js'],
              'dest': '../public/js/scripts.min.js'
          }
      },

      htmlcompressor: {
        compile: {
          files: {
            '../private/temp/index_compressed_temp.html': '../index_uncompressed.html'
          },
          options: {
            type: 'html',
            preserveServerScript: true
          }
        }
      },

      replace: {
        example: {
          src: ['../private/temp/index_compressed_temp.html'],           
          dest: '../index.html',             // destination directory or file
          replacements: [
          { 
            from: 'public/js/client.js',      
            to: 'public/js/scripts.min.js' 
          },
          { 
            from: 'public/css/all.css',               
            to: 'public/css/all.min.css' 
          }/*, { 
            from: /(f|F)(o{2,100})/g,      // regex replacement ('Fooo' to 'Mooo')
            to: 'M$2' 
          }, {
            from: 'Foo',
            to: function (matchedWord) {   // callback replacement
              return matchedWord + ' Bar';
            }
          }*/
          ]
        }
      },

      htmllint: {
          index: ['../index.html']
      }


  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-htmlcompressor');
  grunt.loadNpmTasks('grunt-yui-compressor');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-css');
  grunt.loadNpmTasks('grunt-text-replace');
  grunt.loadNpmTasks('grunt-html');

  // "npm test" runs these tasks
  grunt.registerTask('default', ['jshint', 'sass', 'cssmin', 'min', 'htmlcompressor', 'replace']);

  // Listen for events when files are modified
  grunt.event.on('watch', function(action, filepath) {
    grunt.log.writeln(filepath + ' has ' + action);
  });


};
