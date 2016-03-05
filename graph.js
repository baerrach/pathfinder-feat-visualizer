/*jshint esnext: true */

var featsElement = d3.select("#feats");
var width = featsElement.style("width").replace("px", "");
var height = window.innerHeight -4 -4; // 4px padding top and bottom
var svg = featsElement.append("svg")
      .attr("width", width)
      .attr("height", height);

var link = svg.selectAll(".link"),
    node = svg.selectAll(".node");

var force = d3.layout.force()
      .size([width, height]);

var csvs = [
  "feats.csv",
];
var promisedCsvs = csvs.map(csv);

var feats = {
  nodes: [],
  links: [],
  cache: {}
};
feats.addLinks = function () {
}
feats.addNode = function(value) {
  var node = this.getNode([value.name]);
  node.value = value;
}
feats.createNode = function(name) {
  return {};
}
feats.getNode = function(name) {
  if (this.cache[name] === undefined) {
    this.cache[name] = this.createNode(name);
  }
  return this.cache[name];
}
feats.loadNodes = function(feats) {
  this.nodes = [];
  this.links = [];
  this.cache = {};

  var feat = null;
  feats.forEach(function (feat) {
    this.addNode(feat);
    this.addLinks(feat);
  }, this);

  Object.keys(this.cache).forEach(function (name) {
    var node = this.cache[name];
    this.nodes.push(node);
  }, this);
}

function renderFeats() {
  console.log("renderFeats");
  force
    .nodes(feats.nodes)
    .links(feats.links)
    .on("tick", tick)
    .start();

  link = link.data(feats.links)
    .enter().append("line")
    .attr("class", "link");

  node = node.data(feats.nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", 12);

  //  FeatsElement.style("height", height + "px");
}

function tick() {
  link.attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });

  node.attr("cx", function(d) { return d.x; })
    .attr("cy", function(d) { return d.y; });
}

function csv(url) {
  return new Promise(
    function (resolve, reject) {
      d3.csv(url, function (error, rows) {
        if (error) {
          reject(error);
        }
        resolve(rows);
      });
    }
  );
}

function update() {
  renderFeats();
}

Promise.all(promisedCsvs)
  .then(function (results) {
    feats.loadNodes(results[0]);

    update();
  });

