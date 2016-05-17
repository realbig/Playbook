#!/bin/bash
echo "Setting up \"Child\" Repository..."
git clone https://github.com/realbig/playbook.git ./_site
cd _site
git branch gh-pages origin/gh-pages
git checkout gh-pages
git branch -d master
cd ../
echo "Installing Dependencies..."
npm install
bundle update