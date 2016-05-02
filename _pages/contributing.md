---
layout: default
title: "Contributing To This Website"
---

<div class="home">

    <h1 class="page-heading">{{ page.title }}</h1>

    <ol class="post-list">
        {% assign items = site.contributing | sort: 'order' %}
        {% for post in items %}
          <li>
            <h2>
              <a class="post-link" href="{{ post.url | prepend: site.baseurl }}">{{ post.title }}</a>
            </h2>
          </li>
        {% endfor %}
    </ol>

</div>
