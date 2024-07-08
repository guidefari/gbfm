#!/bin/bash

# Check if the filename argument is provided
if [ -z "$1" ]; then
	echo "Please provide a filename as an argument."
	exit 1
fi

# Get the current date in the specified format
current_date=$(date +"%Y-%m-%dT%H:%M:%S")

# Define the frontmatter content with the current date
frontmatter="---
authorName: Guide Fari
handle: guidefari
avatarUrl: https://res.cloudinary.com/hokaspokas/image/upload/v1661928720/bar_shpohc.png
date: $current_date
---"

# Specify the directory path
directory="../content/micro"

# Create the directory if it doesn't exist
mkdir -p "$directory"

# Create the .mdx file with the frontmatter in the specified directory
echo "$frontmatter" >"$directory/$1.mdx"

echo "Generated $directory/$1.mdx with the specified frontmatter"
