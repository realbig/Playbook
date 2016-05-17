---
layout: page
title:  "Cloning the Repository"
date:   2016-04-26 08:39:55-0400
collection: contributing
order: 2
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
chmod +x init.sh
./init.sh
{% endhighlight %}

This will set up the compiled site (the `gh-pages` branch) within the `_site` directory for you. It will also install all the dependencies necessary for ["Building" step]({{ '/contributing/building/' | prepend: site.baseurl }}) later.

Now your primary project directory will mirror the remote `master` branch and the `_site` directory will mirror the remote `gh-pages` branch. This will allow you to push code to the `master` branch to reflect changes to the source files and to push your generated `_site` directory for changes to the compiled website.

{% include components/collections-prev-next.html %}