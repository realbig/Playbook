---
layout: page
title:  "Understanding Jekyll and Adding Content"
date:   2016-04-28 08:39:55-0400
collection: contributing
order: 3
---

{{ title }}

Jekyll works by converting plain [Markdown](//daringfireball.net/projects/markdown/) into HTML using the [Liquid Templating Engine](//shopify.github.io/liquid/). If you've used [Twig](//twig.sensiolabs.org/) in the past, Liquid may feel a little familiar to you.

Each bit of content that you contribute is handled the same way in a simple `.md` file which Jekyll builds into `.html` for you.

#### Templating

When creating a Page or Post, the most important thing to ensure you add can be seen at the top of this file:

{% highlight yml %}
---
layout: page
title:  "Understanding Jekyll"
date:   2016-04-28 08:39:55-0400
---

{% endhighlight %}

This is called "YAML Front Matter" and it specifies which file in `/_layouts` to use as a base, the Title of the Page/Post, as well as the Published Date. Any number of things that we want to tie to the Page/Post can be placed up here. Think of this as Post Meta, but other things like Taxonomy Terms can be added there as well.

If you take a look at `/_layouts/page.html`, which this Post uses for its template, you will see that its YAML Front Matter includes `layout: default`. This means that this isn't as far back as the rabbit hole goes. 

`/_layouts/default.html` is a much broader file that includes things like the Header and Footer and any wrapping elements, and then has a bit that says `{{ "{{ content " }}}}` which is where `/_layouts/page.html` is included in this case. `/_layouts/page.html` also has a spot that says `{{ "{{ content " }}}}` which is where the current Page/Post is included.

#### Posts vs Pages vs Collections

When creating your Pages/Posts, you may want to understand how "Collections" work.

"Collections" are similar to Custom Post Types in WordPress. This Post is a part of the "Contributing" Collection, as you can see from its place in the source files at `/_contributing/understanding-jekyll-and-adding-content.md` as well as its Permalink.

Here's a nice diagram to help understand when to use a Collection rather than a simple Page or Post.

{% highlight shell %}
+-------------------------------------+         +----------------+
| Can the things be logically grouped?|---No--->|    Use pages   |
+-------------------------------------+         +----------------+
                |
               Yes
                |
                V
+-------------------------------------+         +----------------+
|      Are they grouped by date?      |---No--->|Use a collection|
+-------------------------------------+         +----------------+
                |
               Yes
                |
                V
+-------------------------------------+
|            Use posts                |
+-------------------------------------+
{% endhighlight %}
[Diagram Source](//ben.balter.com/2015/02/20/jekyll-collections/)

The "grouping by date" is a very large distinguishing factor. When creating a Post, you ***must*** follow this naming convention:

{% highlight shell %}
YYYY-MM-DD-post-name.md
{% endhighlight %}

But if you're creating a Page or a Post within a Collection, you only need to include the Post Name for the file name which will be used for the Permalink.

Collections can be easily added by creating a relevant entry in `/_config.yml` prior to building the site.

{% highlight yml %}
    posts:
        output: true
        permalink: /:year/:month/:day/:title/
    pages:
        output: true
        permalink: /:path/
    process: 
        output: true
        permalink: /process/:path/
    contributing: 
        output: true
        permalink: /contributing/:path/
{% endhighlight %}

{% include components/collections-prev-next.html %}