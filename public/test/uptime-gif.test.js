const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { expect } = require('chai');

describe('Uptime gif integration', () => {
  it('should have an element with id uptimeGif pointing to elektryk.gif', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const el = doc.getElementById('uptimeGif');
    expect(el, 'uptimeGif element exists').to.exist;
    expect(el.tagName.toLowerCase()).to.equal('img');
    expect(el.getAttribute('src')).to.include('elektryk.gif');
    expect(el.classList.contains('uptime-gif')).to.be.true;
    expect(el.classList.contains('tag')).to.be.false;
  });
});
