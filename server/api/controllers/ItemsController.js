/**
 * ItemsControllerController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const url = 'https://sv.wikipedia.org/wiki/Portal:Huvudsida'
fs = require('fs')

https: module.exports = {
  itemFunction: async (req, res) => {
    startParsing(url, 200)
    return res.status(200).json('works')
  },
}

function startParsing(url, maxPages) {
  let domain = url.substring(0, url.lastIndexOf('.org'))
  let count = 1
  parseUrl(url, async function afterParse(path) {
    let linksPath = `${path}.links`
    linkArray = await readLinksFile(linksPath)
    while (count < maxPages && linkArray.length > 0) {
      let link = linkArray[0]
      linkArray = linkArray.slice(1, linkArray.length)

      parseUrl(`${domain}${link}`, async function afterParse(path2) {
        linksPath2 = `${path2}.links`
        let linkArray2 = await readLinksFile(linksPath2)
        linkArray = [...linkArray, ...linkArray2]
      })
      count++
    }
  })
}

const readFile = (path, opts = 'utf8') =>
  new Promise((resolve, reject) => {
    fs.readFile(path, opts, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

const writeFile = (path, data, opts = 'utf8') =>
  new Promise((resolve, reject) => {
    fs.writeFile(path, data, opts, err => {
      if (err) reject(err)
      else resolve()
    })
  })

async function readLinksFile(linksPath) {
  const data = await readFile(linksPath)
  let links = data.toString()
  return links.split('\n')
}

function parseUrl(url, callback) {
  let path = `files/${getFileNameFromUrl(url)}`
  saveHTML(path, async function afterSaveHTML(htmlPath) {
    const data = await readFile(htmlPath)
    let html = data.toString()
    await saveLinks(path, html)
    await saveWords(path, html)
    callback(path)
  })
}
async function saveWords(path, html) {
  let linesOfText = []
  cheerio('h1, h2, h3, h4, h5, p', html).each((index, textObject) => {
    let text = cheerio(textObject)
      .text()
      .trim() // removes whitespaces in front and at end of text
      .replace(/[,.-]/g, '')
      .replace(/ *\[[^)]*\] */g, '') // removes '[]' and content
      .replace(/\s/g, ' ') // removes extra whitespaces within text
      .toLowerCase()
    if (text) {
      linesOfText.push(text)
    }
  })
  await writeFile(`${path}.words`, linesOfText.join(' '))
}

async function saveLinks(path, html) {
  let links = []
  cheerio('a', html).each((index, urlObject) => {
    let link = cheerio(urlObject)[0].attribs.href
    if (link) {
      if (link.substring(0, 2) === '//') {
        link = link.substring(2, link.length) //removes '//' at start from links
      }
      if (link.substring(link.length - 1, link.length) === '/') {
        link = link.substring(0, link.length - 1) // removes ending '/' from links
      }
      if (link.length > 7) {
        // avoid unfinished or 'fake' links e.g. '#'
        if (
          link.includes('#') ||
          link.includes('.jpg') ||
          link.includes('.png')
        ) {
          // do nothing
        } else if (link.substring(0, 5) === '/wiki') {
          links.push(link)
        }
      }
    }
  })
  await writeFile(`${path}.links`, links.join('\n'))
}

function getFileNameFromUrl(url) {
  // url = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0]
  url = url.substring(url.lastIndexOf('/') + 1, url.length)
  url = url.replace(':', '_')
  return url
}

function saveHTML(path, callback) {
  let htmlPath = `${path}.html`
  puppeteer
    .launch()
    .then(browser => {
      return browser.newPage()
    })
    .then(page => {
      return page.goto(url).then(() => {
        return page.content()
      })
    })
    .then(async html => {
      await writeFile(htmlPath, html)
      callback(htmlPath)
    })
    .catch(error => {
      console.log(error)
    })
}
