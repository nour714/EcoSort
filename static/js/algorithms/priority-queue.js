/**
 * =========================================================================================
 * طابور الأولوية باستخدام الكومة الصغرى الثنائية (Binary Min-Heap Priority Queue)
 * =========================================================================================
 * يوفر عمليات الإدراج والاستخراج بتعقيد زمني لوغاريتمي O(log N).
 * يُستخدم لتسريع خوارزميات المسارات الأقصر (Dijkstra و A*) لتحقيق التعقيد O((V + E) log V).
 * =========================================================================================
 */

class BinaryMinHeap {
    constructor() {
        this.heap = [];
    }

    /**
     * إدراج عنصر مع قيمته أو أولويته
     * @param {*} item - العنصر (مثل معرف العقدة nodeId)
     * @param {number} priority - الأولوية أو التكلفة (المسافة أو قيمة f)
     */
    push(item, priority) {
        this.heap.push({ item, priority });
        this._bubbleUp(this.heap.length - 1);
    }

    /**
     * استخراج العنصر ذي الأولوية الصغرى (أقل مسافة أو fScore)
     * @returns {{item: *, priority: number}|null}
     */
    pop() {
        if (this.heap.length === 0) return null;
        const top = this.heap[0];
        const bottom = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            this._sinkDown(0);
        }
        return top;
    }

    /**
     * معاينة العنصر الأصغر دون حذفه
     */
    peek() {
        return this.heap.length > 0 ? this.heap[0] : null;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    get size() {
        return this.heap.length;
    }

    _bubbleUp(index) {
        const element = this.heap[index];
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.heap[parentIndex];
            if (element.priority >= parent.priority) break;
            this.heap[index] = parent;
            this.heap[parentIndex] = element;
            index = parentIndex;
        }
    }

    _sinkDown(index) {
        const length = this.heap.length;
        const element = this.heap[index];

        while (true) {
            const leftChildIdx = 2 * index + 1;
            const rightChildIdx = 2 * index + 2;
            let swap = null;

            if (leftChildIdx < length) {
                if (this.heap[leftChildIdx].priority < element.priority) {
                    swap = leftChildIdx;
                }
            }

            if (rightChildIdx < length) {
                if (
                    (swap === null && this.heap[rightChildIdx].priority < element.priority) ||
                    (swap !== null && this.heap[rightChildIdx].priority < this.heap[leftChildIdx].priority)
                ) {
                    swap = rightChildIdx;
                }
            }

            if (swap === null) break;
            this.heap[index] = this.heap[swap];
            this.heap[swap] = element;
            index = swap;
        }
    }
}

if (typeof window !== 'undefined') {
    window.BinaryMinHeap = BinaryMinHeap;
    window.MinHeap = BinaryMinHeap;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BinaryMinHeap;
}
