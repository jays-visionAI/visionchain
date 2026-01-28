import { Component, Show } from 'solid-js';
import { Trash2 } from 'lucide-solid';
import { Motion } from 'solid-motionone';
import { AdminDocument } from '../../../services/firebaseService';

interface DocDeleteModalProps {
    isOpen: boolean;
    doc: AdminDocument | null;
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const DocDeleteModal: Component<DocDeleteModalProps> = (props) => {
    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 z-[300] flex items-center justify-center p-6">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={props.onClose}
                    class="absolute inset-0 bg-black/90 backdrop-blur-xl"
                />
                <Motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    class="relative w-full max-w-md bg-[#0c0c0c] border border-red-500/20 rounded-[32px] p-8 shadow-2xl shadow-red-500/5 text-center"
                >
                    <div class="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-500">
                        <Trash2 class="w-10 h-10" />
                    </div>
                    <h3 class="text-2xl font-black italic tracking-tight mb-2">DELETE DOCUMENT?</h3>
                    <p class="text-sm text-gray-500 font-medium mb-8">
                        Are you sure you want to delete <span class="text-white font-bold">"{props.doc?.title}"</span>?<br />
                        This action cannot be undone.
                    </p>

                    <div class="flex flex-col gap-3">
                        <button
                            onClick={props.onConfirm}
                            disabled={props.isDeleting}
                            class="w-full py-4 bg-red-500 hover:bg-red-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Show when={props.isDeleting}>
                                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </Show>
                            YES, DELETE PERMANENTLY
                        </button>
                        <button
                            onClick={props.onClose}
                            class="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Keep Document
                        </button>
                    </div>
                </Motion.div>
            </div>
        </Show>
    );
};
