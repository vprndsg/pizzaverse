import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("body")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("background", "#111");

Promise.all([
  fetch('bottle_nodes.json').then(r => r.json()),
  fetch('bottle_links.json').then(r => r.json())
]).then(([nodes, links]) => {
  init(nodes, links);
});

function init(allNodes, allLinks) {
  let mainNodes = allNodes.filter(n => n.type !== 'bottle');
  let mainLinks = allLinks.filter(l => {
    const src = allNodes.find(n => n.id === l.source);
    const tgt = allNodes.find(n => n.id === l.target);
    return src.type !== 'bottle' && tgt.type !== 'bottle';
  });

  const simulation = d3.forceSimulation(mainNodes)
    .force('link', d3.forceLink(mainLinks).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.type === 'bottle' ? 15 : 30));

  const linkSel = svg.selectAll('line.link')
    .data(mainLinks)
    .enter().append('line')
    .attr('class', 'link')
    .attr('stroke', '#666');

  let nodeSel = svg.selectAll('circle.node')
    .data(mainNodes, d => d.id)
    .enter().append('circle')
    .attr('class', d => `node ${d.type}`)
    .attr('r', 12)
    .attr('fill', d => d.type === 'varietal' || d.type === 'region' ? '#ffa500' : '#33aaff')
    .call(drag(simulation));

  nodeSel.append('title').text(d => d.name);

  nodeSel.on('click', (event, d) => {
    if (d.type === 'bottle') return;
    toggleBottles(d);
  });

  simulation.on('tick', () => {
    linkSel
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    svg.selectAll('circle.node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
  });

  let expandedParent = null;

  function toggleBottles(parent) {
    if (expandedParent && expandedParent.id === parent.id) {
      collapse();
      return;
    }
    collapse();
    expandedParent = parent;
    const childBottles = allNodes.filter(n => n.type === 'bottle' && (n.varietal === parent.name || n.region === parent.name));
    if (!childBottles.length) return;

    const radius = 100;
    const angleStep = 2 * Math.PI / childBottles.length;
    childBottles.forEach((child, i) => {
      const angle = i * angleStep;
      child.fx = parent.x + radius * Math.cos(angle);
      child.fy = parent.y + radius * Math.sin(angle);
    });

    mainNodes = mainNodes.concat(childBottles);
    childBottles.forEach(c => mainLinks.push({ source: parent, target: c }));

    simulation.nodes(mainNodes);
    simulation.force('link').links(mainLinks);

    linkSel.data(mainLinks)
      .join(enter => enter.append('line').attr('class', 'link').attr('stroke', '#999'));

    nodeSel = svg.selectAll('circle.node')
      .data(mainNodes, d => d.id)
      .join(enter => enter.append('circle')
        .attr('class', 'node bottle')
        .attr('r', 6)
        .attr('fill', '#ccc')
        .call(addTooltip)
        .on('click', (event, d) => {
          event.stopPropagation();
          alert(`${d.name} (${d.vintage}) - ${d.winery}\n${d.description}`);
        }));

    simulation.alpha(0.5).restart();
  }

  function collapse() {
    if (!expandedParent) return;
    mainNodes = mainNodes.filter(n => n.type !== 'bottle');
    mainLinks = mainLinks.filter(l => l.source.type !== 'bottle' && l.target.type !== 'bottle');
    simulation.nodes(mainNodes);
    simulation.force('link').links(mainLinks);

    svg.selectAll('circle.node.bottle').remove();
    svg.selectAll('line.link').data(mainLinks).exit().remove();

    expandedParent = null;
    simulation.alpha(0.5).restart();
  }
}

function addTooltip(sel) {
  sel.append('title').text(d => `${d.name} — ${d.winery}, ${d.vintage}: ${d.description}`);
}

function drag(sim) {
  function dragstarted(event) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event) {
    if (!event.active) sim.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}
