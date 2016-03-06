/*jshint esnext: true */

// Polyfill
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

var featsElement = d3.select("#feats");
var width = featsElement.style("width").replace("px", "");
var height = window.innerHeight -4 -4; // 4px padding top and bottom
var svg = featsElement.append("svg")
      .attr("width", width)
      .attr("height", height);

// build the arrow (http://bl.ocks.org/d3noob/5141278)
svg.append("svg:defs").selectAll("marker")
    .data(["end"])      // Different link/path types can be defined here
  .enter().append("svg:marker")    // This section adds in the arrows
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", -1.5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
  .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");

svg = svg.append("g")
  .call(d3.behavior.zoom().scaleExtent([0.25, 4]).on("zoom", zoom))

svg.append("rect")
  .attr("class", "overlay")
  .attr("width", width)
  .attr("height", height);

svg = svg.append("g");

var link = svg.selectAll(".link"),
    node = svg.selectAll(".node");

var force = d3.layout.force()
      .size([width, height])
      .linkDistance(60)
      .charge(-300);

/* Initialize tooltip */
tip = d3.tip().attr('class', 'd3-tip').html(function(d) { 
  var tipText = "No name";
  if (d.value) {
    tipText = d.value.name;
  }
  return tipText;
});
svg.call(tip);

var csvs = [
  "feats.csv",
];
var promisedCsvs = csvs.map(csv);

var feats = {
  nodes: [],
  links: [],
  cache: {}
};
feats.addLinks = function (feat) {
  var prerequisitesAsLinks = this.getPrerequisitesAsLinks(feat);

  prerequisitesAsLinks.forEach(function(prerequisite) {
    this.links.push(prerequisite)
  }, this);
}
feats.addNode = function(value) {
  var node = this.getNode([value.name]);
  node.value = value;
}
feats.createNode = function(name) {
  return { value: { name: name} };
}
feats.getPrerequisitesAsLinks = function(feat) {
  var prerequisitesAsLinks = [];
  var prerequisitesAsString = feat.prerequisites;
  var andPrerequisites;

  if (prerequisitesAsString.endsWith(".")) {
    prerequisitesAsString = prerequisitesAsString.slice(0, -1);
  }
  if (prerequisitesAsString.indexOf(";") !== -1) {
    andPrerequisites = prerequisitesAsString.split(";");
    andPrerequisites.forEach(function (andPrerequisite) {
      if (andPrerequisite.indexOf(",") !== -1) {
        var orPrerequisites = andPrerequisite.split(",");
        orPrerequisites.forEach(function (orPrerequisite) {
          prerequisitesAsLinks.push(
            {
              source: this.getNode(feat.name),
              target: this.getNode(orPrerequisite),
              type: "OR",
              description: andPrerequisite
            }
          );
        }, this);
      }
      else {
        prerequisitesAsLinks.push(
          {
            source: this.getNode(feat.name),
            target: this.getNode(andPrerequisite),
            type: "AND",
            description: andPrerequisite
          }
        );
      }
    }, this);
  }
  else {
    andPrerequisites = prerequisitesAsString.split(",");
    andPrerequisites.forEach(function (prerequisite) {
      prerequisitesAsLinks.push(
        {
          source: this.getNode(feat.name),
          target: this.getNode(prerequisite),
          type: "AND",
          description: prerequisite
        }
      );
    }, this);
  }


  return prerequisitesAsLinks;
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
  force
    .nodes(feats.nodes)
    .links(feats.links)
    .on("tick", tick)
    .start();

  node = node.data(feats.nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", 12)
    .on('mouseover.tip', tip.show)
    .on('mouseout.tip', tip.hide);

  link = link.data(feats.links)
    .enter().append("line")
    .attr("class", "link")
    .attr("marker-end", "url(#end)");;


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

function zoom() {
  svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

Promise.all(promisedCsvs)
  .then(function (results) {
    feats.loadNodes(results[0]);

    update();
  });
