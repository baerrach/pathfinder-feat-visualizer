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

// Polyfill
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/ ) {
    'use strict';
    var O = Object(this);
    var len = parseInt(O.length) || 0;
    if (len === 0) {
      return false;
    }
    var n = parseInt(arguments[1]) || 0;
    var k;
    if (n >= 0) {
      k = n;
    } else {
      k = len + n;
      if (k < 0) {k = 0;}
    }
    var currentElement;
    while (k < len) {
      currentElement = O[k];
      if (searchElement === currentElement ||
          (searchElement !== searchElement && currentElement !== currentElement)) { // NaN !== NaN
        return true;
      }
      k++;
    }
    return false;
  };
}

var customFilters = {
  withinBounds: withinBounds
};

var panRatio = 0.20;
var maxRadius = 12;
var maxStrokeWidth = 1.5;
var labelOffset = [4, 0];
var scaleExtent = [0.03125, 32];
var featsElement = d3.select("#feats");
var width = Number(featsElement.style("width").replace("px", ""));
var height = window.innerHeight -4 -4; // 4px padding top and bottom
var x = d3.scale.linear()
      .domain([0, width])
      .range([0, width]);
var y = d3.scale.linear()
      .domain([0, height])
      .range([height, 0]);
var r = d3.scale.linear()
      .domain([scaleExtent[0],1,scaleExtent[1]])
      .range([0.25, maxRadius, maxRadius]) // shrink but dont get bigger than defined radius
      .clamp(maxRadius);
var strokeWidth = d3.scale.linear()
      .domain([scaleExtent[0],1,scaleExtent[1]])
      .range([0.25, maxStrokeWidth, maxStrokeWidth]) // shrink but dont get bigger than defined thickness
      .clamp(maxStrokeWidth);
var svg = featsElement.append("svg")
      .attr("width", width)
      .attr("height", height);
var headers;
var queries = [
  {
    name: "General",
    query: "type == \"General\""
  }
];
queries[0].expression = compileExpression(queries[0].query, customFilters);

var editingQueryFilterIndex;
var filterResults;

// build the arrow (http://bl.ocks.org/d3noob/5141278)
svg.append("svg:defs").selectAll("marker")
  .data(["end"])      // Different link/path types can be defined here
  .enter().append("svg:marker")    // This section adds in the arrows
  .attr("id", String)
  .attr("markerUnits", "userSpaceOnUse")
  .attr("class", "arrow")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 25)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("svg:path")
  .attr("d", "M0,-5L10,0L0,5");

var zoom = d3.behavior.zoom()
      .size([width, height])
      .x(x)
      .y(y)
      .scaleExtent(scaleExtent)
      .on("zoom", onZoom);

svg.append("rect")
  .attr("class", "overlay")
  .attr("width", width)
  .attr("height", height)
  .call(zoom);

svg.append("g").attr("name", "links");
svg.append("g").attr("name", "nodes");
svg.append("g").attr("name", "labels");

var enableRedraw,
    selected = null,
    ui = {},
    startTime,
    endTime;

var force = d3.layout.force()
      .size([width, height])
      .theta(0.95)
      .linkDistance(30)
      .charge(-350)
      .on("tick", onTick)
      .on("start", onForceStart)
      .on("end", onForceStop);

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
  "prerequisites.csv"
];
var promisedCsvs = csvs.map(csv);

var feats = {
  allNodes: [],
  nodes: [],
  links: [],
  cache: {},
  nodeKey: function(d) { return d.value.name; },
  linkKey: function (d) { return d.source.value.name + " requires " + d.target.value.name; }
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
  node.x = value.x ? Number(value.x) : undefined;
  node.y = value.y ? Number(value.y) : undefined;
  node.fixed = false;
  if (isNaN(node.x)) {
    console.log(value.id + ":" + value.name + " x = NaN");
  }
  if (isNaN(node.y)) {
    console.log(value.id + ":" + value.name + " y = NaN");
  }
}
feats.getPrerequisitesAsLinks = function(feat) {
  var prerequisitesAsLinks = [];
  var prerequisitesAsString = feat.prerequisites;
  var andPrerequisites;

  if (typeof prerequisitesAsString === "undefined") {
    return [];
  }
  prerequisitesAsString = prerequisitesAsString.trim();
  if (prerequisitesAsString === "") {
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
  // Add the nodes
  feats.forEach(function (feat) {
    if ("Mythic" === feat.type) {
      feat.name = feat.name + " (Mythic)";
    }
    if (this.cache[feat.name]) {
      var duplicate = this.cache[feat.name];
      if (duplicate.type !== feat.type
          || duplicate.source !== feat.type) {
        console.log("Duplicate found: name=" + feat.name
                    + " type=" + feat.type
                    + " souce=" + feat.souce);
      }
      return;
    }
    this.addNode(feat);
  }, this);
}
feats.buildLinks = function() {
  this.links = [];
  this.allNodes.forEach(function (node) {
    this.addLinks(node.value);
  }, this);
}
feats.buildNodeList = function() {
  Object.keys(this.cache).forEach(function (name) {
    var node = this.cache[name];
    this.allNodes.push(node);
  }, this);

  var n = Math.floor(Math.sqrt(this.allNodes.length));
  this.allNodes.forEach(function(d, i) {
    if (!d.x) {
      d.x = 20 + (r(1)*2+8)*(i % n);
    }
    if (!d.y) {
      d.y = 20 + (r(1)*2+8)*(Math.floor(i / n));
    }
  });
}

function onForceStart() {
  ui.start.attr("disabled", true);
  ui.stop.attr("disabled", null);

  startTime = performance.now();
}

function start() {
  force
    .nodes(feats.nodes)
    .links(feats.links)
  force.start();
}

function onForceStop() {
  ui.start.attr("disabled", null);
  ui.stop.attr("disabled", true);
  updateLayoutStatus(0);

  endTime = performance.now();
  var diff = moment.duration(endTime - startTime);
  console.log(diff.humanize());

  reposition();
}

function stop() {
  force.stop();
}

function updateQueryUi() {
  var query = d3.select(".queries").selectAll(".query").data(queries);

  var inputGroup = query.enter()
        .insert("div", "#add-filter").attr("class", "query")
        .append("div").attr("class", "input-group")
  inputGroup.append("div").attr("class", "input-group-btn")
    .append("button")
    .attr("class", "btn btn-default draggable")
    .attr("type", "button")
    .append("span")
    .attr("class", "glyphicon glyphicon-menu-hamburger");

  inputGroup.append("button")
    .attr("class", "query-filter btn btn-default btn-block")
    .attr("type" , "button")
    .attr("data-toggle", "modal")
    .attr("data-target", "#add-filter-dialog")
    .attr("data-filter-id", "0")
    .append("span")
    .attr("class", "glyphicon glyphicon-edit pull-right");

  query.exit().remove();

  query.select(".query-filter").text(function (d) {
    return d.name;
  });
}

function setupUi() {
  var layout = d3.selectAll(".layout");

  ui.start = layout.select("[name=start]");
  ui.start.on('click', start);

  ui.stop = layout.select("[name=stop]");
  ui.stop.on('click', stop);

  ui.layoutStatusContainer = layout.select("#layout-status-container");
  ui.layoutStatus = layout.select("#layout-status");
  updateLayoutStatus(0);

  updateQueryUi();

  d3.select("#add-filter-dialog .filter-query").on("input", checkFilter);
  d3.select("#add-filter-dialog .filter-query").on("change", updateQuery);
  d3.selectAll("#add-filter-dialog .filter-actions").on("click", setFilterAction);
  d3.select("#add-filter-dialog .btn-primary").on("click", updateQuery);
  $('#add-filter-dialog').on('show.bs.modal', setupAddFilterDialog);

  d3.select("#enable-redraw").on("change", function() {
    enableRedraw = this.checked;
  });

  d3.select("#pan-top-left").on("click", panTopLeft);
  d3.select("#pan-top-center").on("click", panTopCenter);
  d3.select("#pan-top-right").on("click", panTopRight);
  d3.select("#pan-center-left").on("click", panCenterLeft);
  d3.select("#pan-center-center").on("click", panHome);
  d3.select("#pan-center-right").on("click", panCenterRight);
  d3.select("#pan-bottom-left").on("click", panBottomLeft);
  d3.select("#pan-bottom-center").on("click", panBottomCenter);
  d3.select("#pan-bottom-right").on("click", panBottomRight);

}

function setSelection(d) {
  if (selected) {
    selected.classed("selected", false);
  }
  selected = d3.select(this);
  selected.classed("selected", true);
}

function reposition() {
  var s = performance.now();
  positionNodes();
  positionLabels();
  positionLinks();

  var e = performance.now();
  var diff = moment.duration(e - s);
  console.log("reposition time=" + diff.toString());

}

function positionNodes() {
  var f = { expression: compileExpression("withinBounds(x,y)", customFilters) };
  feats.nodes = runFilters([f].concat(queries));

  var node = svg.select("g[name=nodes]").selectAll(".node").data(feats.nodes, feats.nodeKey);
  node.enter().append("circle");
  node.exit().remove();
  node.attr("class", "node")
    .attr("name", function (d) { return d.value.name; })
    .on('click.toSelect', setSelection)
    .on('mouseover.tip', tip.show)
    .on('mouseout.tip', tip.hide);

  node
    .attr("cx", function (d) {
      d.value.x = d.x;
      return x(d.x);
    })
    .attr("cy", function (d) {
      d.value.y = d.y;
      return y(d.y);
    })
    .attr("r", r(zoom.scale()));
}

function positionLinks() {
  var links = feats.links;

  links = links.filter(function (l) {
    return feats.nodes.includes(l.source) || feats.nodes.includes(l.target);
  });

  var link = svg.select("g[name=links]").selectAll(".link").data(links, feats.linkKey);
  link.enter().append("line");
  link.exit().remove();
  link.attr("class", "link")
    .attr("name", feats.linkKey)
    .attr("marker-end", "url(#end)")
    .on('click.toSelect', setSelection);

  link
    .style("stroke-width", function (d) {
      return strokeWidth(zoom.scale()) + "px";
    })
    .attr("x1", function(d) { return x(d.source.x); })
    .attr("y1", function(d) { return y(d.source.y); })
    .attr("x2", function(d) { return x(d.target.x); })
    .attr("y2", function(d) { return y(d.target.y); });
}

function positionLabels() {
  var shouldHideLabels = zoom.scale() < 1;

  var label = svg.select("g[name=labels]").selectAll(".label").data(feats.nodes, feats.nodeKey);
  label.enter().append("text");
  label.exit().remove();
  label.attr("class", "label")
    .attr("name", function (d) { return d.value.name; })
    .text(function(d) {
      return d.value.name;
    });
  label
    .classed("hidden", shouldHideLabels)
    .attr("x", function (d) { return x(d.x) + r(1) + labelOffset[0]; })
    .attr("y", function (d) { return y(d.y) + labelOffset[1]; });
}

function onTick(event) {
  var percentComplete = (104 - Math.floor(event.alpha*1000));

  updateLayoutStatus(percentComplete);

  if (enableRedraw) {
    reposition();
  }
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
  reposition();
}

function pan(_) {
  // _ contains x-ratio and y-ratio to translate width and height by.
  var translate = zoom.translate();
  translate[0] += width*_[0];
  translate[1] += height*_[1];
  zoom.translate(translate);
  zoom.event(svg);
}

function panTopLeft() {
  pan([panRatio, panRatio]);
}

function panTopCenter() {
  pan([0, panRatio]);
}

function panTopRight() {
  pan([-panRatio, panRatio]);
}

function panCenterLeft() {
  pan([panRatio, 0]);
}

function panHome() {
  zoom.translate([width/2, height/2]);
  zoom.event(svg);
}

function panCenterRight() {
  pan([-panRatio, 0]);
}

function panBottomLeft() {
  pan([panRatio, -panRatio]);
}

function panBottomCenter() {
  pan([0, -panRatio]);
}

function panBottomRight() {
  pan([-panRatio, -panRatio]);
}

function onZoom() {
  reposition();
}

Promise.all(promisedCsvs)
  .then(function (results) {
    headers = results[0][0];
    feats.loadNodes(results[0]);
    feats.loadNodes(results[1]);

    feats.buildNodeList();
    feats.buildLinks();
    update();
  });

function printXYFeats() {
  console.log( "id, name, x, y" );
  feats.nodes.forEach(function (node) {
    if (node.value.id && node.value.id < 9000) {
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

function updateLayoutStatus(percentComplete) {
  if (percentComplete <= 0) {
    ui.layoutStatusContainer.classed("invisible", true);
    ui.layoutStatus.style("width", 0);
  }
  else {
    ui.layoutStatus.attr("aria-valuenow", percentComplete);
    percentComplete += "%";
    ui.layoutStatus.style("width", percentComplete);
    ui.layoutStatusContainer.classed("invisible", false);
  }
}

function runFilters(filters) {
  var filteredNodes = feats.allNodes;

  filters.forEach(function(f) {
    filteredNodes = filteredNodes.filter(function (d) {
      var isFiltered = f.expression(d.value);
      return isFiltered;
    });
  });

  return filteredNodes;
}

function setupAddFilterDialog(event) {
  var button = $(event.relatedTarget); // Button that triggered the modal
  var filterDialog = d3.select("#add-filter-dialog");
  if ("add-filter" === button.attr('id')) {
    editingQueryFilterIndex = d3.selectAll(".query-filter").length;
    filterDialog.select(".filter-name")[0][0].value = "";
    filterDialog.select(".filter-query")[0][0].value = "";
  }
  else {
    editingQueryFilterIndex = button.data("filter-id");
    filterDialog.select(".filter-name")[0][0].value = queries[editingQueryFilterIndex].name;
    filterDialog.select(".filter-query")[0][0].value = queries[editingQueryFilterIndex].query;
  }

  var results = d3.select(".filter-results table");
  var headerColumns = d3.keys(feats.allNodes[0].value).map(function (value) {
    return {
      title: value,
      data: value,
      defaultContent: "<i>Not set</i>"
    };
  });
  if (!filterResults) {
    filterResults = $(".filter-results table").dataTable(
      {
        scrollY: "200px",
        scrollX: true,
        autoWidth: false,
        columns: headerColumns
      }
    ).api();
  }

  checkFilter();
}

function checkFilter() {
  var errorMessage = $("#Filter-dialog-error");
  try {
    var currentFilters = queries.slice(0, Math.min(queries.length, editingQueryFilterIndex));
    var filterDialog = d3.select("#add-filter-dialog");
    var filterQuery = filterDialog.select(".filter-query")[0][0].value;
    if (filterQuery) {
      var f = compileExpression(filterQuery, customFilters);
      currentFilters.push({expression:f});
    }

    var filteredNodes = runFilters(currentFilters);
    filteredNodes = filteredNodes.map(function (node) {
      return node.value;
    });

    // Use DataTables data api to build table for me.
    filterResults.clear();
    filterResults.rows.add(filteredNodes);
    filterResults.draw();

    $("#filter-dialog-error").parent().addClass("hidden");
  }
  catch (e) {
    $("#filter-dialog-error").html(e.message)
      .parent().removeClass("hidden");
  }

}

function updateQuery(d) {
  console.log("updateQuery d="+d);
}

function setFilterAction() {
  var filterAction = d3.select("#add-filter-dialog .filter-action");
  filterAction.text(this.text);
}

function withinBounds(x1, y1) {
  // Need to use the x(), y() for calculating coordinate space, it has already adjusted for translation and zoom
  return x(x1) > 0 && x(x1) < width && y(y1) > 0 && y(y1) < height;
}
