---
layout: page
title:  "Cloning The Repository"
date:   2016-04-26 08:39:55-0400
---

{{ title }}

This may seem like an obvious step, but bare with me.

Given that we have two branches, `master` which holds the source files and `gh-pages` which holds the compiled website, we will need to clone them both in a specific way to most easily work with the files locally.

First, run 

{% highlight shell %}
git clone https://github.com/realbig/playbook.git
{% endhighlight %}

into any directory that you would like. After `cd`-ing into that directory, run 

{% highlight shell %}
git clone https://github.com/realbig/playbook.git ./_site
{% endhighlight %}

to clone the repository again within a child directory called `_site`.

Next, `cd` into `_site` and run

{% highlight shell %}
git checkout -b origin/gh-pages gh-pages
{% endhighlight %}

in order to pull down the remote `gh-pages` branch into a local branch of the same name.

At this point, I'd recommend deleting the `master` branch for this "child repository" by running `git branch -d master` to prevent confusion.

Now your primary project directory will mirror the remote `master` branch and the `_site` directory will mirror the remote `gh-pages` branch. This will allow you to push code to the `master` branch to reflect changes to the source files and to push your generated `_site` directory for changes to the compiled website.

From here, your final step will be going back up to the primary project directory and running the following commands:

{% highlight shell %}
npm install
bundle update
{% endhighlight %}

to install all the dependencies necessary for ["Building" step]({{ '/contributing/building/' | prepend: site.baseurl }}) later.