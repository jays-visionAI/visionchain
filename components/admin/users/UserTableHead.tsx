import { Component } from 'solid-js';

export const UserTableHead: Component = () => {
    return (
        <div class="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <div class="col-span-2">User Info</div>
            <div class="col-span-2">Reg Status</div>
            <div class="col-span-1">Wallet</div>
            <div class="col-span-3">Wallet Address</div>
            <div class="col-span-1">Vesting</div>
            <div class="col-span-1">Referrer</div>
            <div class="col-span-1 text-right pr-4">Action</div>
        </div>
    );
};
