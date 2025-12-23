import { Mesh, OrthographicCamera, PlaneGeometry } from './three.module.js';

class Pass {
	constructor() {
		this.enabled = true;
		this.needsSwap = true;
		this.clear = false;
		this.renderToScreen = false;
	}

	setSize() {}

	render() {
		console.error( 'Pass: .render() must be implemented in derived pass.' );
	}
}

const _camera = new OrthographicCamera( -1, 1, 1, -1, 0, 1 );
const _geometry = new PlaneGeometry( 2, 2 );

class FullScreenQuad {
	constructor( material ) {
		this._mesh = new Mesh( _geometry, material );
	}

	dispose() {
		this._mesh.geometry.dispose();
	}

	render( renderer ) {
		renderer.render( this._mesh, _camera );
	}

	get material() {
		return this._mesh.material;
	}

	set material( value ) {
		this._mesh.material = value;
	}
}

export { Pass, FullScreenQuad };
