#!/bin/bash
echo "Building for Production..."
gulp --production
cd _site
git add -A
git status
read -p "Commit Message: " desc
git commit -m "$desc"
read -p "Push to gh-pages? Y/N " -n 1 -r
echo # Move to new line
if [[ $REPLY =~ ^[Yy]$ ]]
then
    git push
fi