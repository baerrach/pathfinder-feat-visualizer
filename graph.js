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

var radius = 12;
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
  .attr("class", "arrow")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 25)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("svg:path")
  .attr("d", "M0,-5L10,0L0,5");

svg = svg.append("g")
  .call(d3.behavior.zoom().scaleExtent([0.125, 8]).on("zoom", zoom))

svg.append("rect")
  .attr("class", "overlay")
  .attr("width", width)
  .attr("height", height);

svg = svg.append("g");

var link = svg.append("g").selectAll(".link"),
    node = svg.selectAll(".node"),
    selected = null,
    ui = {};

var force = d3.layout.force()
      .size([width, height])
      .theta(0.95)
      .linkDistance(30)
      .charge(-350)
      .on("tick", tick)
      .on("start", onStart)
      .on("end", onStop);

/* Initialize tooltip */
tip = d3.tip().attr('class', 'd3-tip').html(function(d) {
  var tipText = "No name";
  if (d.value) {
    tipText = d.value.name;
  }
  return tipText;
});
svg.call(tip);

setupUi();

var csvs = [
  "Feats - Updated 01Mar2016.csv",
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
  var node = this.getNode(value.name);
  node.value = value;
  node.x = Number(value.x || 0);
  node.y = Number(value.y || 0);
  node.fixed = false;
}
feats.getPrerequisitesAsLinks = function(feat) {
  var prerequisitesAsLinks = [];
  var prerequisitesAsString = feat.prerequisites;
  var andPrerequisites;

  if (!prerequisitesAsString) {
    return [];
  }

  // Small, Tiny, Diminutive, or Fine.
  // Large, Huge, Gargantuan, Colossal.

  // <skill> X rank re-link back to basic skill
  // <attribute> X re-link back to basic attribute
  // same for BAB
  // same for caster level?
  // same for class level X

// Or Ability to acquire a special mount
// Or ability to cast illusion (figment) spells
// Or spell-like ability with the curse descriptor
// X speed


  if (prerequisitesAsString.endsWith(".")) {
    prerequisitesAsString = prerequisitesAsString.slice(0, -1);
  }
  if (prerequisitesAsString.indexOf(";") !== -1) {
    andPrerequisites = prerequisitesAsString.split(";");
    andPrerequisites.forEach(function (andPrerequisite) {
      if (!andPrerequisite) {
        return;
      }

      if (andPrerequisite.indexOf(", ") !== -1) {
        var orPrerequisites = andPrerequisite.split(", ");
        orPrerequisites.forEach(function (orPrerequisite) {
          if (orPrerequisite.startsWith("or ")) {
            orPrerequisite = orPrerequisite.slice(2);
          }
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
    andPrerequisites = prerequisitesAsString.split(", ");
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
  function createNode(name) {
    return {
      x: 0,
      y: 0,
      value: { name: name }
    };
  }

  name = name.trim();
  name = name.charAt(0).toUpperCase() + name.slice(1);

  if (this.cache[name] === undefined) {
    this.cache[name] = createNode(name);
  }
  return this.cache[name];
}
feats.loadNodes = function(feats) {
  this.nodes = [];
  this.links = [];
  this.cache = {};

  // Add the nodes
  feats.forEach(function (feat) {
    if ("Mythic" === feat.type) {
      feat.name = feat.name + " (Mythic)";
    }
    if (this.cache[feat.name]) {
      feat.name = feat.name + " (Duplicate)"
      feat.prerequisites = "Duplicate";
    }
    this.addNode(feat);
  }, this);

  // Do the links last to avoid creating duplicates nodes
  // when the prequisites creates placeholders instead of real nodes.
  // This way the only place holders are for non-feat prerequisites.
  feats.forEach(function (feat) {
    this.addLinks(feat);
  }, this);


  Object.keys(this.cache).forEach(function (name) {
    var node = this.cache[name];
    this.nodes.push(node);
  }, this);

  var n = Math.floor(Math.sqrt(this.nodes.length));
  this.nodes.forEach(function(d, i) {
    d.x = 20 + (radius*2+8)*(i % n);
    d.y = 20 + (radius*2+8)*(Math.floor(i / n));
  });
}

function renderFeats() {
  force
    .nodes(feats.nodes)
    .links(feats.links)

  link = link.data(feats.links)
    .enter().append("line")
    .attr("class", "link")
    .attr("marker-end", "url(#end)")
    .on('click.toSelect', setSelection);

  node = node.data(feats.nodes)
    .enter().append("g")
    .attr("class", "node");

  node.append("circle")
    .attr("class", "node")
    .attr("r", radius)
    .on('click.toSelect', setSelection)
    .on('mouseover.tip', tip.show)
    .on('mouseout.tip', tip.hide);

  node.append("text")
    .attr("x", radius + 4)
    .attr("dy", ".35em")
    .text(function(d) {
      return d.value.name;
    });

}

function onStart() {
  ui.start.attr("disabled", true);
  ui.stop.attr("disabled", null);
}

function start() {
  force.start();
}

function onStop() {
  ui.start.attr("disabled", null);
  ui.stop.attr("disabled", true);
}

function stop() {
  force.stop();
}

function setupUi() {
  var layout = d3.selectAll(".layout"),
      button;
  button = layout.select("[name=start]");
  button.on('click', start);
  ui.start = button;

  button = layout.select("[name=stop]");
  button.on('click', stop);
  ui.stop = button;
}

function setSelection(d) {
  if (selected) {
    selected.classed("selected", false);
  }
  selected = d3.select(this);
  selected.classed("selected", true);
}

function tick() {

  link.attr("x1", function(d) {
    return d.source.x;
  })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });

  node
    .attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")"; });
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
  start();
}

function zoom() {
  svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

Promise.all(promisedCsvs)
  .then(function (results) {
    feats.loadNodes(results[0]);

    update();
  });

function printXYFeats() {
  console.log( "id, name, x, y" );
  feats.nodes.forEach(function (node) {
    if (node.value.id) {
      console.log( node.value.id + "," + node.value.name + ", " + node.x + "," + node.y );
    }
  });
}

function printXYPrequisites() {
  console.log( "name, x, y" );
  feats.nodes.forEach(function (node) {
    if (!node.value.id || node.value.id >= 9000) {
      console.log( node.value.name + "," + node.x + "," + node.y );
    }
  });
}

function printXYAllNodes() {
  console.log( "id, name, x, y" );
  feats.nodes.forEach(function (node) {
    var id = node.value.id || 0;
    console.log( id + "," + node.value.name + ", " + node.x + "," + node.y );
  });
}
