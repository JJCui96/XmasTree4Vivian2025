import { Color } from './three.module.js';
import { Pass } from './Pass.js';

class MaskPass extends Pass {
	constructor( scene, camera ) {
		super();

		this.scene = scene;
		this.camera = camera;
		this.clear = false;
		this.needsSwap = false;
		this.inverse = false;

		this.clearColor = new Color( 0, 0, 0 );
		this.clearAlpha = 0;
	}

	render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {
		const context = renderer.getContext();
		const state = renderer.state;

		// Do not write to color or depth.
		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( false );

		// Lock color and depth buffers.
		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );

		// Set up stencil.
		let writeValue = this.inverse ? 0 : 1;
		let clearValue = this.inverse ? 1 : 0;

		state.buffers.stencil.setTest( true );
		state.buffers.stencil.setOp( context.REPLACE, context.REPLACE, context.REPLACE );
		state.buffers.stencil.setFunc( context.ALWAYS, writeValue, 0xffffffff );
		state.buffers.stencil.setClear( clearValue );

		// Draw into stencil buffer.
		renderer.setRenderTarget( readBuffer );
		if ( this.clear ) renderer.clear();
		renderer.render( this.scene, this.camera );

		renderer.setRenderTarget( writeBuffer );
		if ( this.clear ) renderer.clear();
		renderer.render( this.scene, this.camera );

		// Unlock color and depth buffers.
		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );

		// Only render where stencil is set to 1.
		state.buffers.stencil.setFunc( context.EQUAL, 1, 0xffffffff );
		state.buffers.stencil.setOp( context.KEEP, context.KEEP, context.KEEP );
	}
}

class ClearMaskPass extends Pass {
	constructor() {
		super();
		this.needsSwap = false;
	}

	render( renderer /*, writeBuffer, readBuffer, deltaTime, maskActive */ ) {
		renderer.state.buffers.stencil.setTest( false );
	}
}

export { MaskPass, ClearMaskPass };
