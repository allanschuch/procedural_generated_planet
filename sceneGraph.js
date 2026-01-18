"use strict";

class Node {
    constructor() {
        this.children = [];
        this.localMatrix = m4.identity();
        this.worldMatrix = m4.identity();
        this.parent = null;
        this.drawInfo = {
            uniforms: {},
            programInfo: null,
            bufferInfo: null,
            vertexArray: null,
        }; 
    }

    setParent(parent) {
        // remove us from our parent
        if (this.parent) {
            const ndx = this.parent.children.indexOf(this);
            if (ndx >= 0) {
                this.parent.children.splice(ndx, 1);
            }
        }
        // Add us to our new parent
        if (parent) {
            parent.children.push(this);
        }
        this.parent = parent;
    }

    updateWorldMatrix(parentWorldMatrix) {
        if (parentWorldMatrix) {
            // a matrix was passed in so do the math
            m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
        } else {
            // no matrix was passed in so just copy.
            m4.copy(this.localMatrix, this.worldMatrix);
        }

        // now process all the children
        const worldMatrix = this.worldMatrix;
        this.children.forEach(function(child) {
            child.updateWorldMatrix(worldMatrix);
        });
    }
}