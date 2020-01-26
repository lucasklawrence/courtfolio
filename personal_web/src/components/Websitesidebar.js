import React from "react";
import Avatar from '@material-ui/core/Avatar';
import Sidebar from './Sidebar'
function Websitesidebar({ items }) {
  return (
    <div>
      <Avatar>LKL</Avatar>
      <Sidebar items={items} />
    </div>
  );
}

export default Websitesidebar;