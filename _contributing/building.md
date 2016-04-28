---
layout: page
title:  "Building"
date:   2016-04-28 08:39:55-0400
---

{{ title }}

As you may have noticed in the ["Cloning the Repository" step]({{ '/contributing/cloning-the-repository/' | prepend: site.baseurl }}), this website uses [gulp](http://gulpjs.com/) for automating tasks.

Running `gulp` at the project root will trigger a bunch of tasks including building your SASS, concatenating your JavaScript, and setting up [BrowserSync](https://www.browsersync.io/) and serving up a demo of the website at `localhost:3000`. Each time you change a relevant source file the `watch` task will re-trigger all the other tasks and automatically inject any changes into the website as you're viewing it.

Running `gulp`, however, only compiles for local viewing and testing. It includes `/_config_local.yml` and overwrites the `baseurl` and `url` settings to ensure all permalinks work within your local instance. Because of this, you do not want to commit these built files to `gh-pages`.

To generate the desired files for `gh-pages`, you will want to run `gulp --production`. This runs all the necessary tasks *except* running BrowserSync and the `watch` task. This command *doesn't* include `/_config_local.yml` into the build process which makes the generated permalinks all acceptable for pushing to `gh-pages`.

You can commit to `master` after running either `gulp` or `gulp --production` as the generated files are all within the `/_site` directory which is included in the `/.gitignore` for the root directory.