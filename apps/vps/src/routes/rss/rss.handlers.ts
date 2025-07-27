import { eq } from "drizzle-orm";
import type { AppRouteHandler } from "@/lib/types";
import { db } from "@/db";
import { audioTable } from "@/db/audio.schema";
import type { GetRSSFeedRoute } from "./rss.routes";

export const getRSSFeed: AppRouteHandler<GetRSSFeedRoute> = async (c) => {
  try {
    // Fetch mixes from database
    const mixes = await db.select().from(audioTable).where(eq(audioTable.type, "mix"));
    
    const sortedMixes = mixes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );


    const rssHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN" "http://www.w3.org/TR/REC-html40/loose.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" lang="en">
    <head>
        <title>Goosebumps.fm Mixes RSS Feed</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"></meta>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></meta>
        <style type="text/css">
            :root {
                /* Goosebumps.fm Brand Colors */
                --highlight: #9bfd9e;
                --bg: hsl(202, 61%, 22%);
                --darker-bg: #111827;
                --pastel-green-1: #b6fadf;
                --pastel-green-2: #4e8c71;
                --default-text: hsl(194, 52%, 67%);
                --white: #ffffff;
                --black: #1a1a1a;
                --gray: #6b7280;
                --trans-bg: rgba(155, 253, 158, 0.1);
                --border-color: rgba(75, 140, 113, 0.3);
            }

            ::selection {
                background-color: var(--highlight);
                color: var(--black);
            }

            html, body {
                margin: auto;
                padding: 20px;
                max-width: 70ch;
                background-color: var(--bg);
                word-wrap: break-word;
                overflow-wrap: break-word;
                color: var(--default-text);
                line-height: 1.6;
            }

            html, body, button, code, input {
                font-family: 'JetBrains Mono', monospace;
            }

            h1 {
                color: var(--pastel-green-1);
                font-weight: 700;
            }

            h2, h3, h4, h5, h6 {
                color: var(--pastel-green-2);
                font-weight: 600;
            }

            a {
                color: var(--highlight);
                text-decoration-thickness: 0.3ex;
                text-underline-offset: 0.3ex;
                transition: color 0.2s ease;
            }

            a:hover {
                color: var(--pastel-green-1);
            }

            nav {
                padding: 1rem;
                background: var(--darker-bg);
                border-radius: 8px;
                margin-bottom: 2rem;
                border: 1px solid var(--border-color);
            }

            hr {
                border: none;
                height: 1px;
                background: var(--border-color);
                margin: 2rem 0;
            }

            .audio-player {
                margin-top: 1rem;
                padding: 1rem;
                background: var(--darker-bg);
                border-radius: 8px;
                border: 1px solid var(--border-color);
            }

            .audio-player audio {
                width: 100%;
                height: 40px;
                border-radius: 4px;
            }

            .item-meta {
                font-size: 0.85rem;
                color: var(--gray);
                margin-bottom: 1rem;
            }

            .item-description {
                color: var(--default-text);
                line-height: 1.7;
                margin-bottom: 1rem;
                opacity: 0.9;
            }

            .mix-item {
                padding: 1.5rem;
                margin-bottom: 2rem;
                background: rgba(17, 24, 39, 0.5);
                border-radius: 12px;
                border: 1px solid var(--border-color);
                transition: all 0.2s ease;
            }

            .mix-item:hover {
                background: rgba(17, 24, 39, 0.8);
                border-color: var(--highlight);
                transform: translateY(-2px);
            }
        </style>
    </head>
    <body>
        <nav>
            <a class="head_link" target="_blank" href="https://goosebumps.fm">← Go back to goosebumps.fm</a>
            <p>
                <strong>This is a web feed,</strong>
                also known as an RSS feed. You can <strong>subscribe</strong>
                by copying the URL from the address bar into your newsreader.
            </p>
            <p>
                Visit <a href="https://aboutfeeds.com">About Feeds</a>
                to get started with newsreaders and subscribing. It's free!
            </p>
        </nav>
        <hr></hr>
        <div>
            <header>
                <h1>
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="vertical-align: text-bottom; width: 1.2em; height: 1.2em;" class="pr-1" id="RSSicon" viewBox="0 0 256 256">
                        <defs>
                            <linearGradient x1="0.085" y1="0.085" x2="0.915" y2="0.915" id="RSSg">
                                <stop offset="0.0" stop-color="#E3702D"></stop>
                                <stop offset="0.1071" stop-color="#EA7D31"></stop>
                                <stop offset="0.3503" stop-color="#F69537"></stop>
                                <stop offset="0.5" stop-color="#FB9E3A"></stop>
                                <stop offset="0.7016" stop-color="#EA7C31"></stop>
                                <stop offset="0.8866" stop-color="#DE642B"></stop>
                                <stop offset="1.0" stop-color="#D95B29"></stop>
                            </linearGradient>
                        </defs>
                        <rect width="256" height="256" rx="55" ry="55" x="0" y="0" fill="#CC5D15"></rect>
                        <rect width="246" height="246" rx="50" ry="50" x="5" y="5" fill="#F49C52"></rect>
                        <rect width="236" height="236" rx="47" ry="47" x="10" y="10" fill="url(#RSSg)"></rect>
                        <circle cx="68" cy="189" r="24" fill="#FFF"></circle>
                        <path d="M160 213h-34a82 82 0 0 0 -82 -82v-34a116 116 0 0 1 116 116z" fill="#FFF"></path>
                        <path d="M184 213A140 140 0 0 0 44 73 V 38a175 175 0 0 1 175 175z" fill="#FFF"></path>
                    </svg>
                    Goosebumps.fm Mixes
                </h1>
                <p>Curated mixes from the Goosebumps.fm archive</p>
                <a class="head_link" target="_blank" href="https://goosebumps.fm">← Go back to goosebumps.fm</a>
            </header>
            <h2>Recent Mixes</h2>
            ${sortedMixes.map(mix => `
            <div class="mix-item">
                <h3>
                    <a target="_blank" href="https://goosebumps.fm/read/mixes/${mix.slug}">${encodeXML(mix.title)}</a>
                </h3>
                <small class="item-meta">
                    Published: ${new Date(mix.createdAt).toUTCString()}
                    • Guide Fari
                </small>
                ${mix.description ? `
                <div class="item-description">
                    ${encodeXML(mix.description)}. Get the tracklist and more immersive experience at https://goosebumps.fm/read/mixes/${mix.slug}
                </div>` : ''}
                ${mix.url ? `
                <div class="audio-player">
                    <audio controls="controls" preload="none">
                        <source src="${mix.url}" type="audio/mpeg"/>
                        Your browser does not support the audio element.
                    </audio>
                </div>` : ''}
            </div>`).join('')}
        </div>
    </body>
</html>`;

    return c.html(rssHtml, 200, {
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return c.text('Internal Server Error', 500);
  }
};

function encodeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

