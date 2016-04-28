---
layout: page
title:  "Preparing Your Environment"
date:   2016-04-26 08:39:55-0400
collection: contributing
order: 1
---

{{ title }}
{{ page.last_modified_at }}

To help later on, make sure you have `source ~/.profile` added to your `~/.bash_profile`

If you don't have Homebrew installed, you will want to [go ahead and do that as well](http://brew.sh/).

Next within your terminal, run 

{% highlight shell %}
curl -sSL https://get.rvm.io | bash
{% endhighlight %}

In order to install [RVM](https://rvm.io/) as this will help us easily update and swap between Ruby versions as-needed.

If you get any errors during the installation process, run `brew doctor` and follow any of the instructions there. This will likely be the need to run some `brew link` commands.

If you did have errors, run 

{% highlight shell %}
rvm reinstall ruby-2.3.0
{% endhighlight %}

To reistall Ruby 2.3.0 within your `~/.rvm` directory.

After successful installation of RVM, go ahead and run

{% highlight shell %}
rvm use ruby-2.3.0
{% endhighlight %}

This will force any calls to Ruby to use v2.3.0. You can check this by running `ruby -v` in your Terminal.

Next run 

{% highlight shell %}
gem install bundler
{% endhighlight %}

[Bundler](http://bundler.io/) is similar to [npm](https://www.npmjs.com/package/npm) for Ruby projects and will help us manage our Ruby Gem dependencies (Including Jekyll itself)

{% include collections-prev-next.html %}