'use strict';

var es = require('event-stream');
var knox = require('knox');
var gutil = require('gulp-util');
var mime = require('mime');
mime.default_type = 'text/plain';

module.exports = function (aws, options) {
  options = options || {};

  if (!options.delay) { options.delay = 0; }

  var client = knox.createClient(aws);
  var waitTime = 0;
  var regexGzip = /\.([a-z]{2,})\.gz$/i;
  var regexGeneral = /\.([a-z]{2,})$/i;

  return es.mapSync(function (file) {

      // Verify this is a file
      if (!file.isBuffer()) { return file; }

      var uploadPath = file.path.replace(file.base, options.uploadPath || '');
      uploadPath = uploadPath.replace(new RegExp('\\\\', 'g'), '/');
      var headers = { 'x-amz-acl': 'public-read' };
      if (options.headers) {
          for (var key in options.headers) {
              headers[key] = options.headers[key];
          }
      }
      if (regexGzip.test(file.path)) {
        // shekhei: this seems to be a better approach IMO
        // Set proper encoding for gzipped files, remove .gz suffix
        headers['Content-Encoding'] = 'gzip';
        if ( options.gzippedOnly ) {
          uploadPath = uploadPath.substring(0, uploadPath.length - 3);
        }
      } else if (options.gzippedOnly) {
        return file;
      }
      var strippedUploadPath = regexGzip.test(uploadPath) ? uploadPath.substring(0, uploadPath.length -3) : uploadPath;

      // Set content type based of file extension
      if (!headers['Content-Type'] && regexGeneral.test(strippedUploadPath)) {
        headers['Content-Type'] = mime.lookup(strippedUploadPath);
        if (options.encoding) {
          headers['Content-Type'] += '; charset=' + options.encoding;
        }
      }

      headers['Content-Length'] = file.stat.size;
      if ( typeof options.beforeUpload === "function" ) {
	  // TODO: support async later
          options.beforeUpload.call({headers: headers, file: file, uploadPath: uploadPath});
      }
      console.log(uploadPath, headers);
      client.putBuffer(file.contents, uploadPath, headers, function(err, res) {

        if (err || res.statusCode !== 200) {
          gutil.log(gutil.colors.red('[FAILED]', file.path + " -> " + uploadPath));
        } else {
          gutil.log(gutil.colors.green('[SUCCESS]', file.path + " -> " + uploadPath));
          res.resume();
        }
      });

      return file;
  });
};
