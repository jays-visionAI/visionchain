import { createSignal, Show } from 'solid-js';
import { uploadTokenSaleData, TokenSaleEntry, sendInvitationEmail } from '../../services/firebaseService';

export const UploadCSV = () => {
    const [dragActive, setDragActive] = createSignal(false);
    const [file, setFile] = createSignal<File | null>(null);
    const [isUploading, setIsUploading] = createSignal(false);
    const [uploadStatus, setUploadStatus] = createSignal<{ success: boolean, message: string } | null>(null);

    const handleDrag = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
            setUploadStatus(null);
        }
    };

    const handleChange = (e: any) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setUploadStatus(null);
        }
    };

    const parseCSV = async (file: File): Promise<TokenSaleEntry[]> => {
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        const entries: TokenSaleEntry[] = [];

        // Start from index 1 to skip header
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map(v => v.trim());

            // Map based on expected order: email, partnerCode, amountToken, date, unlockRatio, vestingPeriod
            // Should add validation here based on headers in production
            if (values.length >= 6) {
                entries.push({
                    email: values[0],
                    partnerCode: values[1],
                    amountToken: Number(values[2]),
                    date: values[3],
                    unlockRatio: Number(values[4]),
                    vestingPeriod: Number(values[5]),
                    status: 'Pending'
                });
            }
        }
        return entries;
    };

    const handleUpload = async () => {
        if (!file()) return;
        setIsUploading(true);
        try {
            const entries = await parseCSV(file()!);
            const count = await uploadTokenSaleData(entries);

            // Send invitation emails for each unique entry
            let emailCount = 0;
            const baseUrl = window.location.origin; // Use current origin or hardcode to visionchain.co

            for (const entry of entries) {
                try {
                    await sendInvitationEmail(entry.email, entry.partnerCode, baseUrl);
                    emailCount++;
                } catch (err) {
                    console.error(`Failed to send email to ${entry.email}:`, err);
                }
            }

            setUploadStatus({
                success: true,
                message: `Successfully uploaded ${count} entries. ${emailCount} invitation emails queued.`
            });
        } catch (error) {
            console.error(error);
            setUploadStatus({
                success: false,
                message: 'Failed to parse or upload CSV. Please check format.'
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div class="text-slate-300">
            <h2 class="text-xl font-bold text-white mb-6">Upload User Data (CSV)</h2>

            <div class="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 mb-8 text-amber-500 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                Note: Duplicate email addresses will be excluded. Only unique email entries will be stored. File must follow the required CSV format.
            </div>

            <div class="mb-6">
                <label class="block text-sm font-medium mb-2 text-slate-400">CSV Format Requirements</label>
                <div class="bg-[#0B0E14] border border-slate-700 rounded-lg p-3 text-slate-500 text-sm font-mono">
                    email, PartnerCode, amountToken, date, unlockRatio, vestingperiod
                </div>
            </div>

            {/* Drag & Drop Area */}
            <div
                class={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center transition-all duration-300 mb-8 cursor-pointer
                    ${dragActive()
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-700 bg-[#0B0E14]/50 hover:border-slate-600'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <div class="text-center">
                    <Show when={!file()} fallback={
                        <div class="flex flex-col items-center">
                            <div class="bg-green-500/20 p-3 rounded-full mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span class="text-white font-medium">{file()?.name}</span>
                            <span class="text-slate-500 text-sm mt-1">{(file()!.size / 1024).toFixed(1)} KB</span>
                        </div>
                    }>
                        <p class="text-slate-400 mb-4">Click to upload or drag and drop</p>
                        <label class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors inline-block">
                            Select File
                            <input type="file" class="hidden" accept=".csv" onChange={handleChange} />
                        </label>
                    </Show>
                </div>
            </div>

            <Show when={file()}>
                <div class="flex justify-end">
                    <button
                        class={`px-6 py-2 rounded-lg font-medium transition-colors ${isUploading()
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                        onClick={handleUpload}
                        disabled={isUploading()}
                    >
                        {isUploading() ? 'Uploading...' : 'Upload & Process'}
                    </button>
                </div>
            </Show>

            {/* Status Message */}
            <Show when={uploadStatus()}>
                <div class={`mt-6 p-4 rounded-lg border ${uploadStatus()?.success
                    ? 'bg-green-900/20 border-green-800 text-green-400'
                    : 'bg-red-900/20 border-red-800 text-red-400'
                    }`}>
                    <div class="font-bold mb-1">
                        {uploadStatus()?.success ? 'Successfully Uploaded' : 'Failed to Upload'}
                    </div>
                    <div class="text-sm opacity-90">{uploadStatus()?.message}</div>
                </div>
            </Show>
        </div>
    );
};
