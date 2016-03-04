/*jshint esnext: true */

var featsElement = d3.select("#feats");
var width = applicationsElement.style("width").replace("px", "");
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

var feats = null;
var graph = {};

function renderFeats() {
  force
      .nodes(graph.nodes)
//      .links(graph.links)
      .start();

  link = link.data(graph.links)
    .enter().append("line")
      .attr("class", "link");

  node = node.data(graph.nodes)
    .enter().append("circle")
      .attr("class", "node")
      .attr("r", 12);

//  featsElement.style("height", height + "px");
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
    feats = results[0];
    
    graph.nodes = feats.map(function (row) {
      return { name: feats.name };
    });
    update();
  });
