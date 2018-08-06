import {Node} from './graphit.js';

window.addEventListener('load', () => {
	fetch('./bíblia/kja.json')
		.then(response => response.json())
		.then(iniciarPágina)
		.catch(ex => {
			console.error(ex);
			iniciarPágina();
		});

	//Script de importação do texto bíblico
	//import_kja();
});

function iniciarPágina(json = {}) {
	let div = document.createElement('div');
	div.classList.add('Cabeçalho');
	
	div.innerHTML = '<input id="input" type="file" accept=".json">';
	let input = div.firstChild;
	input.addEventListener('input', handle);

	let button = document.createElement('button');
	button.innerHTML = '💾 salvar';
	button.addEventListener('click', () => {save(json);});

	div.appendChild(button);

	document.body = document.createElement('body');
	document.body.appendChild(div);
	
	open(json);
};

function handle(event) {
	var reader = new FileReader();
	reader.onload = (e) => {
		try {
			let json = JSON.parse(e.target.result);
			iniciarPágina(json);
		} catch(exception) {
			console.error(exception);
			iniciarPágina();
		}
	};

	reader.readAsText(event.target.files[0]);
}

function* keyGen(init = 0, next = Date.now) {
	var lastKey = init;
	while(true) {
		yield (lastKey = Math.max(next(), lastKey + 1)).toString(36);
	}
}

const classificação = (node, element) => {
	let c = [];
	if(node.nContent > 0) c.push('Conjunto');
	if(node.nEdges > 0) c.push('Comentado');

	if((node.nContent > 0 || node.nEdges > 0) && !element.classList.contains('Expandido')) {
		c.push('Expansível');
	}
	return c;
};

const nodoElement = node => {
	const element = document.createElement('div');
	element.classList.add('Nodo');

	element.innerText = node.data || '';
	element.setAttribute('data-nodo', node.id);
	element.classList.add(...classificação(node, element));

	return element;
}

const contêinerElement = node => {
	const container = document.createElement('div');
	container.classList.add('Contêiner');
	container.appendChild(nodoElement(node));

	const referencias = document.createElement('div');
	referencias.classList.add('Referências');
	container.appendChild(referencias);

	const conteúdo = document.createElement('div');
	conteúdo.classList.add('Conteúdo');
	container.appendChild(conteúdo);

	return container;
}

const refElement = (idx, from) => {
	const aresta = document.createElement('div');
	aresta.classList.add('Aresta');
	aresta.setAttribute('data-from', from.id);
	aresta.setAttribute('data-idx', idx);
	aresta.innerHTML = from.edgeData(idx);

	const ref = document.createElement('div');
	ref.classList.add('Referência');
	ref.appendChild(aresta);

	ref.appendChild(contêinerElement(from.edgeTo(idx)));
	return ref;
}

const nodoFromElement = (element, json) => {
	return new Node(element.getAttribute('data-nodo'), json);
};
 
function open(json) {
	//Exibe conteúdo de "0" em uma filha de <body>
	let first = new Node('0', json);
	document.body.appendChild(contêinerElement(first));

	document.body.addEventListener('click', event => {
		const target = event.target;
		if(event.ctrlKey && (target.classList.contains('Nodo') || target.classList.contains('Aresta'))) { //Edição de elemento
			target.addEventListener('blur', blur);
			target.setAttribute('contenteditable', true);
			target.focus();
		}

		if(document.body.getAttribute('data-selecting') == 'true') {
			associar(event);
		}
		event.stopPropagation();
	});

	document.body.addEventListener('dblclick', event => {
		const target = event.target;
		if(target.classList.contains('Expansível')) { //Expansão de elemento
			
			expand(target.parentNode, json);
		}
		event.stopPropagation();
	});

	window.addEventListener('keydown', event => {
		console.log(event.key);
		if(event.key == '*' && event.ctrlKey) {
			document.body.setAttribute('data-selecting', 'true');
		}
	});
	
	function blur(event) {
		const target = event.target;
		target.removeEventListener('blur', blur);
		target.removeAttribute('contenteditable');

		if(target.classList.contains('Nodo')) { 
			let node = new Node(target.getAttribute('data-nodo'), json);
			node.data = target.innerHTML;
			propagate(`[data-nodo="${node.id}"]`, target, json);
		} else if(target.classList.contains('Aresta')) {
			const from = new Node(target.getAttribute('data-from'), json);
			const idx = target.getAttribute('data-idx');
			from.edgeData(idx, target.innerHTML);
			propagate(`[data-from="${from.id}"][data-idx="${idx}"]`, target, json);
		}
	}
	
	let targetFrom;
	function associar(event) {
		if(!targetFrom) {
			targetFrom = event.target;
			return;
		}
	
		document.body.setAttribute('data-selecting', 'false');

		let from = nodoFromElement(targetFrom, json);
		let idx = from.nEdges;

		from.edgeTo(idx, nodoFromElement(event.target, json));
		from.edgeData(idx, '');

		targetFrom.classList.add(...classificação(from, targetFrom));
		if(targetFrom.classList.contains('Expandido')) {
			appendRef(targetFrom.parentElement, idx, from);
			//targetFrom.parentElement.appendChild(refElement(idx, from));
		}
		
		propagate(`[data-nodo="${from.id}"]`, targetFrom, json);

		targetFrom = undefined;
	}
}

const appendRef = (container, idx, n) => {
	const referências_el = container.firstChild.nextElementSibling;
	referências_el.appendChild(refElement(idx, n)); 
};
const appendContent = (container, idx, n) => {
	const conteúdo_el = container.firstChild.nextElementSibling.nextElementSibling;
	conteúdo_el.appendChild(contêinerElement(n.child(idx))); 
};

function expand(container, json) {
	const nodo_el = container.firstChild;
	const referências_el = nodo_el.nextElementSibling;
	const conteúdo_el = referências_el.nextElementSibling;
	const n = new Node(nodo_el.getAttribute('data-nodo'), json);

	//Exibição das referências
	for(let idx = 0; idx < n.nEdges; idx++) appendRef(container, idx, n);

	//Exibição do conteúdo
	for(let idx = 0; idx < n.nContent; idx++) appendContent(container, idx, n);

	nodo_el.classList.remove('Expansível');
	nodo_el.classList.add('Expandido');
}

function propagate(selector, origem, json) {
	let elements = Array.from(document.querySelectorAll(selector));
	for (const element of elements) {
		if (element != origem) {
			element.innerHTML = origem.innerHTML;
			if(element.hasAttribute('data-nodo'))
				element.classList.add(...classificação(nodoFromElement(element, json), element));
			//const classList = element.classList;
			//const newElement = origem.cloneNode(true);
			//newElement.classList = classList;

			//element.parentNode.replaceChild(newElement, element);
		}
	}
}

function save(json) {
	let content = JSON.stringify(json, null, 1);
    let blob = new Blob([content], { type: 'text/plain' });
    let	anchor = document.createElement('a');

	anchor.download = "graphit.json";
	anchor.href = window.URL.createObjectURL(blob);
	anchor.dataset.downloadurl = ['application/json', anchor.download, anchor.href].join(':');
	anchor.click();
}

function import_kja() {
	fetch('./kja.txt')
		.then(response => response.text())
		.then(text => {
			const newIdGenerator = keyGen(0, () => 0);
			const newId = () => newIdGenerator.next().value;

			let json = {};
			let nodoLivro, nodoCapítulo;
			let livro, capítulo;
			let nodoBiblia = new Node('0', json, 'Bíblia King James Atualizada');

			let lines = text.match(/.+/gi);
			let i = 0;
			for(let line of lines) {
				let match = line.match(/(.+?)\s+(\d+):(\d+)\s+(.+)/i);
				if(livro != match[1]) {
					livro = match[1];
					nodoLivro = new Node(newId(), json, livro);
					
					capítulo = match[2];
					nodoCapítulo = new Node(newId(), json, 'Capítulo ' + capítulo);
					nodoLivro.insert(nodoCapítulo);

					nodoBiblia.insert(nodoLivro)
				} else if (capítulo != match[2]) {
					capítulo = match[2];
					nodoCapítulo = new Node(newId(), json, 'Capítulo ' + capítulo);
					nodoLivro.insert(nodoCapítulo);
				}
				nodoCapítulo.insert(new Node(newId(), json, match[3] + '. ' + match[4])); //Versículo
				
				//console.log(match);
				//if(i++ == 30000) break;
			}
			//console.log(json);
			return json;
		})
		.then(iniciarPágina)
		.catch(ex => {console.error(ex)});
}